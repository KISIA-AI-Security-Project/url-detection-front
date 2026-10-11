// OAuth code + PKCE. Access/refresh tokens stay in memory, never in the bundle or browser storage.
const passwordSymbols = new Set(Array.from('^$*.[]{}()?"!@#%&/\\,><\':;|_~`=+-'));
export function signupPasswordRules(password) {
  const length = Array.from(password).length >= 8;
  const symbol = Array.from(password).some(character => passwordSymbols.has(character));
  return {length, symbol, valid: length && symbol && Array.from(password).length <= 256 && !/\s/u.test(password)};
}
export class SignupFailure extends Error {
  constructor(message, code='request_failed') {super(message);this.code=code;}
}
function signupEmail(email) {
  const value = email.trim();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new SignupFailure('인증 메일을 받을 이메일 주소를 확인해 주세요.', 'invalid_email');
  return value;
}
const signupErrors = {
  UsernameExistsException: '이미 가입을 시작한 이메일입니다. 로그인하거나 이메일 인증을 이어가 주세요.',
  InvalidPasswordException: '비밀번호는 8자 이상, 특수문자 1개 이상으로 입력해 주세요.',
  CodeMismatchException: '인증 코드가 일치하지 않습니다. 메일의 코드를 다시 확인해 주세요.',
  ExpiredCodeException: '인증 코드가 만료됐습니다. 새 코드를 받아 주세요.',
  TooManyRequestsException: '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  TooManyFailedAttemptsException: '인증 시도가 많습니다. 잠시 후 다시 시도해 주세요.',
  LimitExceededException: '메일 발송 한도에 도달했습니다. 가입이 접수됐을 수 있으니 잠시 후 이메일 인증을 이어가 주세요.',
  CodeDeliveryFailureException: '인증 메일을 보내지 못했습니다. 이메일 주소를 확인하고 다시 받아 주세요.',
  UserNotFoundException: '가입 정보를 확인하지 못했습니다. 이메일 주소를 확인하거나 회원가입을 시작해 주세요.',
  NotAuthorizedException: '인증을 진행할 수 없습니다. 이미 인증했다면 로그인해 주세요.',
  InvalidParameterException: '입력 내용을 확인해 주세요. 이미 인증한 계정이라면 로그인할 수 있습니다.',
};
function delivery(value) {
  const detail = value.CodeDeliveryDetails;
  return typeof detail?.Destination === 'string' && detail.DeliveryMedium === 'EMAIL'
    ? {destination:detail.Destination} : {};
}
export class AuthenticationRequired extends Error {
  constructor(message='로그인이 만료됐습니다. 다시 로그인해 주세요.') {super(message);this.status=401;}
}
export class WebAuth {
  constructor(config) {
    this.config = config;
    this.tokens = null;
    this.pendingRefresh = null;
    this.sessionVersion = 0;
  }
  static random() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  }
  async login(email) {
    const verifier = WebAuth.random(), state = WebAuth.random();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    sessionStorage.setItem('web.oauth', JSON.stringify({verifier,state,created:Date.now()}));
    const url = new URL('/oauth2/authorize', this.config.domain);
    url.search = new URLSearchParams({
      client_id:this.config.client_id,response_type:'code',scope:this.config.scope,
      redirect_uri:this.config.redirect_uri,state,code_challenge:challenge,code_challenge_method:'S256'
    });
    if (email) url.searchParams.set('login_hint', signupEmail(email));
    location.assign(url);
  }
  async signupRequest(operation, values) {
    // Public Cognito signup operations need a client ID, never AWS credentials or a client secret.
    // Keep sign-in on OAuth: API authentication alone does not issue our analysis scope.
    const domain = new URL(this.config.domain);
    const region = domain.hostname.match(/^[a-z0-9-]+\.auth\.([a-z]{2}-[a-z]+-\d)\.amazoncognito\.com$/)?.[1];
    if (domain.protocol !== 'https:' || domain.port || !region)
      throw new SignupFailure('회원가입 연결 설정을 확인하지 못했습니다.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
        method:'POST',headers:{'content-type':'application/x-amz-json-1.1',
          'x-amz-target':`AWSCognitoIdentityProviderService.${operation}`},
        body:JSON.stringify({ClientId:this.config.client_id,...values}),
        credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal
      });
      let result;
      try {result = await response.json();} catch {
        throw new SignupFailure('인증 서버의 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      if (!response.ok) {
        const code = String(result?.__type || '').split('#').at(-1);
        throw new SignupFailure(signupErrors[code] || '인증 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', code);
      }
      if (!result || typeof result !== 'object' || Array.isArray(result))
        throw new SignupFailure('인증 서버의 응답을 확인하지 못했습니다.');
      return result;
    } catch (error) {
      if (error instanceof SignupFailure) throw error;
      throw new SignupFailure('인증 서버에 연결하지 못했습니다. 가입이 접수됐을 수 있으니 이메일 인증을 이어가거나 잠시 후 다시 시도해 주세요.', 'connection_failed');
    } finally {clearTimeout(timeout);}
  }
  async signUp(email, password) {
    const username = signupEmail(email);
    if (!signupPasswordRules(password).valid)
      throw new SignupFailure('비밀번호는 8~256자, 특수문자 1개 이상이며 공백 없이 입력해 주세요.', 'invalid_password');
    const result = await this.signupRequest('SignUp', {
      Username:username,Password:password,UserAttributes:[{Name:'email',Value:username}]
    });
    if (typeof result.UserConfirmed !== 'boolean')
      throw new SignupFailure('가입 응답을 확인하지 못했습니다. 이메일 인증을 이어가 주세요.', 'unexpected_signup');
    return {confirmed:result.UserConfirmed,...delivery(result)};
  }
  async confirmSignUp(email, code) {
    if (!/^\d{6}$/.test(code.trim())) throw new SignupFailure('메일로 받은 6자리 인증 코드를 입력해 주세요.', 'invalid_code');
    await this.signupRequest('ConfirmSignUp', {Username:signupEmail(email),ConfirmationCode:code.trim(),ForceAliasCreation:false});
  }
  async resendSignUpCode(email) {
    return delivery(await this.signupRequest('ResendConfirmationCode', {Username:signupEmail(email)}));
  }
  async initialize() {
    const params = new URLSearchParams(location.search);
    if (!params.has('code') && !params.has('error')) return false;
    const stored = sessionStorage.getItem('web.oauth');
    sessionStorage.removeItem('web.oauth');
    history.replaceState(null,'',location.pathname);
    if (params.has('error')) throw new Error('로그인을 완료하지 못했습니다.');
    let pending;
    try {pending = JSON.parse(stored);} catch {throw new Error('로그인을 다시 시작해 주세요.');}
    if (!pending || typeof pending.verifier !== 'string' || !pending.verifier ||
        params.get('state') !== pending.state || !Number.isFinite(pending.created) ||
        Date.now()-pending.created < 0 || Date.now()-pending.created > 600000)
      throw new Error('로그인 요청이 만료됐습니다. 다시 로그인해 주세요.');
    await this.exchange({grant_type:'authorization_code',code:params.get('code'),
      redirect_uri:this.config.redirect_uri,code_verifier:pending.verifier});
    return true;
  }
  async exchange(values) {
    const version = this.sessionVersion;
    const response = await fetch(new URL('/oauth2/token',this.config.domain), {
      method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:this.config.client_id,...values}),cache:'no-store'
    });
    if (version !== this.sessionVersion) throw new AuthenticationRequired();
    if (!response.ok) {this.tokens=null;throw new AuthenticationRequired();}
    const tokens = await response.json();
    if (version !== this.sessionVersion) throw new AuthenticationRequired();
    if (typeof tokens.access_token !== 'string' || !tokens.access_token ||
        !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0)
      throw new Error('로그인 응답을 확인하지 못했습니다.');
    this.tokens = {...tokens,refresh_token:tokens.refresh_token || this.tokens?.refresh_token,
      expires_at:Date.now()+tokens.expires_in*1000};
  }
  async accessToken() {
    if (!this.tokens) throw new AuthenticationRequired('로그인 후 이용해 주세요.');
    if (this.tokens.expires_at-Date.now() < 45000) {
      if (!this.tokens.refresh_token) {this.tokens=null;throw new AuthenticationRequired();}
      if (!this.pendingRefresh) this.pendingRefresh = this.exchange({
        grant_type:'refresh_token',refresh_token:this.tokens.refresh_token
      }).finally(()=>{this.pendingRefresh=null;});
      await this.pendingRefresh;
    }
    return this.tokens.access_token;
  }
  logout() {
    this.sessionVersion++;
    this.tokens=null; sessionStorage.removeItem('web.oauth');sessionStorage.removeItem('web.activeScan');
    const url = new URL('/logout',this.config.domain);
    url.search = new URLSearchParams({client_id:this.config.client_id,logout_uri:this.config.redirect_uri});
    location.assign(url);
  }
}
