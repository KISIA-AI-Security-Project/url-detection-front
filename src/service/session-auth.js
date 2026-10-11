import {WebAuth as PublicSignupAuth, AuthenticationRequired, SignupFailure, signupPasswordRules} from './auth.js';

// Refresh credentials live behind an opaque HttpOnly cookie. Only the access
// token needed by the existing JWT-protected API is held in this document.
export class WebAuth extends PublicSignupAuth {
  constructor(config) {
    super(config);
    this.listeners = new Set();
    this.pendingSession = null;
    this.pendingLogin = null;
    this.pendingLogout = null;
    this.signupRequests = 0;
    this.sessionRef = null;
    this.loggedOut = sessionStorage.getItem('web.auth.signedOut') === '1';
    this.channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('linkguard-auth') : null;
    this.channel?.addEventListener('message', event => {
      if (event.data?.type === 'logout') this.clearSession();
    });
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {for (const listener of this.listeners) listener();}
  clearSession(persist = false) {
    this.loggedOut = true;
    // This is a local restoration preference, never a deferred server action.
    // Replaying an old logout could otherwise revoke a later shared session.
    if (persist) sessionStorage.setItem('web.auth.signedOut','1');
    this.sessionVersion++;
    this.pendingSession = null;
    this.tokens = null;
    this.sessionRef = null;
    this.notify();
  }
  async authRequest(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/api/auth/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {'X-LinkGuard-Request':'v1', ...(body === undefined ? {} : {'content-type':'application/json'})},
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),
        credentials:'same-origin',cache:'no-store',referrerPolicy:'same-origin',signal:controller.signal
      });
      let result;
      try {result = await response.json();} catch {throw new Error('로그인 서버의 응답을 확인하지 못했습니다.');}
      if (!response.ok) {
        const error = new Error(typeof result?.message === 'string' ? result.message : '인증 요청을 완료하지 못했습니다.');
        error.status = response.status;
        error.code = result?.error || result?.code;
        if (Number.isInteger(result?.retry_after_seconds) && result.retry_after_seconds >= 0 && result.retry_after_seconds <= 86400)
          error.retry_after_seconds = result.retry_after_seconds;
        throw error;
      }
      return result;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('로그인 서버 응답이 지연됩니다. 잠시 후 다시 시도해 주세요.');
      throw error;
    } finally {clearTimeout(timer);}
  }
  applySession(result, version) {
    if (version !== this.sessionVersion || this.loggedOut) throw new AuthenticationRequired();
    if (!result || typeof result.authenticated !== 'boolean') throw new Error('로그인 상태를 확인하지 못했습니다.');
    if (!result.authenticated) {
      const changed = !!this.tokens;
      this.tokens = null;
      this.sessionRef = null;
      if (changed) this.notify();
      return false;
    }
    if (!this.validSessionRef(result.session_ref) || typeof result.access_token !== 'string' || !result.access_token ||
        !Number.isFinite(result.expires_at) || result.expires_at <= Date.now())
      throw new Error('로그인 상태를 확인하지 못했습니다.');
    const changed = !this.tokens || this.sessionRef !== result.session_ref;
    this.sessionRef = result.session_ref;
    this.tokens = {access_token:result.access_token, expires_at:result.expires_at};
    if (changed) this.notify();
    return true;
  }
  validSessionRef(value) {return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);}
  withAuthLock(operation, wait = false) {
    // Serialize cookie-changing flows across live documents of this origin.
    // Logout waits so a cancelled login cannot leave a pending server flow.
    if (typeof navigator === 'undefined' || !navigator.locks?.request) return operation();
    return navigator.locks.request('linkguard-auth-change', {mode:'exclusive', ...(wait ? {} : {ifAvailable:true})}, lock => {
      if (!lock) {
        const error = new Error('다른 탭에서 인증을 처리 중입니다. 완료한 뒤 다시 눌러 주세요.');
        error.code = 'auth_change_pending';
        throw error;
      }
      return operation();
    });
  }
  async readSession(version) {
        for (let attempt = 0; attempt < 12; attempt++) {
          try {
            const result = await this.authRequest('session');
            if (version !== this.sessionVersion) throw new AuthenticationRequired();
            if (!result || typeof result.authenticated !== 'boolean' ||
                (result.authenticated && !this.validSessionRef(result.session_ref)))
              throw new Error('로그인 상태를 확인하지 못했습니다.');
            return result;
          }
          catch (error) {
            if (error?.status === 401) {
              if (version !== this.sessionVersion) throw new AuthenticationRequired();
              return {authenticated:false};
            }
            if (error?.status !== 409 || error?.code !== 'session_refreshing' || attempt === 11) throw error;
            await new Promise(resolve => setTimeout(resolve, 250));
            if (version !== this.sessionVersion) throw new AuthenticationRequired();
          }
        }
  }
  async restoreSession() {
    if (this.loggedOut) return false;
    if (!this.pendingSession) {
      const version = this.sessionVersion;
      const pending = this.readSession(version).then(result => this.applySession(result, version));
      const tracked = pending.finally(() => {if (this.pendingSession === tracked) this.pendingSession = null;});
      this.pendingSession = tracked;
    }
    return this.pendingSession;
  }
  async initialize() {
    const params = new URLSearchParams(location.search);
    if (params.has('code') || params.has('error')) {
      const code = params.get('code'), state = params.get('state');
      for (const key of ['code','state','error','error_description']) params.delete(key);
      history.replaceState(null,'',location.pathname + (params.size ? '?' + params : ''));
      sessionStorage.removeItem('web.oauth');
      if (!code || !state) throw new Error('로그인을 완료하지 못했습니다. 다시 로그인해 주세요.');
      const version = this.sessionVersion;
      const authenticated = this.applySession(await this.authRequest('callback', {code,state}), version);
      if (window.opener && authenticated) {
        window.close();
      }
      return authenticated;
    }
    if (this.loggedOut) {
      // Read the shared baseline while respecting this tab's explicit sign-out.
      // Anonymous GETs must not mint or replace browser-binding cookies.
      const version = this.sessionVersion;
      const result = await this.readSession(version);
      this.sessionRef = result.authenticated ? result.session_ref : null;
      return false;
    }
    return this.restoreSession();
  }
  login(email, password) {
    if (this.pendingLogout) return Promise.reject(new Error('로그아웃 처리 중입니다. 잠시 후 로그인해 주세요.'));
    if (this.signupRequests) return Promise.reject(new Error('이메일 인증 요청을 처리 중입니다. 잠시 후 로그인해 주세요.'));
    if (this.pendingLogin) return this.pendingLogin;
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password || password.length > 256)
      return Promise.reject(new Error('이메일과 비밀번호를 입력해 주세요.'));
    const signedOut = sessionStorage.getItem('web.auth.signedOut');
    const wasLoggedOut = this.loggedOut;
    const version = ++this.sessionVersion;
    let completed = false;
    this.pendingLogin = this.withAuthLock(async () => {
      const credentials = {email:email.trim().toLowerCase(),password};
      let result;
      try {result = await this.authRequest('signin', credentials);}
      catch (error) {
        // The first anonymous request only establishes a browser binding. It
        // never calls the password provider, and can be continued exactly once.
        if (error?.status !== 409 || error?.code !== 'signin_binding_required') throw error;
        if (version !== this.sessionVersion) throw new AuthenticationRequired();
        result = await this.authRequest('signin', credentials);
      }
      if (version !== this.sessionVersion) throw new AuthenticationRequired();
      this.loggedOut = false;
      if (!this.applySession(result, version)) throw new Error('로그인을 완료하지 못했습니다. 다시 시도해 주세요.');
      sessionStorage.removeItem('web.auth.signedOut');
      completed = true;
    }).finally(() => {
      if (!completed && wasLoggedOut && version === this.sessionVersion) {
        // A failed form submission must leave that form mounted with its error.
        this.loggedOut = true;
        this.tokens = null;
        this.sessionRef = null;
        if (signedOut) sessionStorage.setItem('web.auth.signedOut', signedOut);
      }
      this.pendingLogin = null;
    });
    return this.pendingLogin;
  }
  async accessToken() {
    if (this.loggedOut) throw new AuthenticationRequired('로그인 후 이용해 주세요.');
    if (!this.tokens || this.tokens.expires_at - Date.now() < 45000)
      await this.restoreSession();
    if (!this.tokens) throw new AuthenticationRequired('로그인 후 이용해 주세요.');
    return this.tokens.access_token;
  }
  async signupAction(action, intent, values, expectedStatus) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(intent)) throw new SignupFailure('이메일 인증을 다시 시작해 주세요.', 'invalid_intent');
    if (this.pendingLogin || this.pendingLogout) throw new SignupFailure('로그인 처리를 마친 뒤 이메일 인증을 다시 시작해 주세요.', 'auth_request_pending');
    if (this.signupRequests) throw new SignupFailure('이전 이메일 인증 요청을 처리 중입니다. 잠시 후 다시 눌러 주세요.', 'signup_request_pending');
    let result;
    this.signupRequests++;
    try {result = await this.withAuthLock(() => this.authRequest('signup/' + action, {intent_id:intent,...values}));}
    catch (error) {
      const failure = new SignupFailure(error.message, error.code || 'request_failed');
      failure.retry_after_seconds = error.retry_after_seconds;
      throw failure;
    }
    finally {this.signupRequests--;}
    const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (result?.intent_id !== intent || !statuses.includes(result?.status))
      throw new SignupFailure('이메일 인증 응답을 확인하지 못했습니다. 다시 시도해 주세요.', 'unexpected_signup');
    if (expectedStatus === 'complete') {
      if (result.login_required !== true) throw new SignupFailure('가입 완료 응답을 확인하지 못했습니다.', 'unexpected_signup');
    } else if (typeof result.email !== 'string' || result.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) ||
        !Number.isFinite(result.expires_at) || result.expires_at <= Date.now() ||
        !Number.isInteger(result.retry_after_seconds) || result.retry_after_seconds < 0 || result.retry_after_seconds > 86400 ||
        (result.masked_destination !== undefined && (typeof result.masked_destination !== 'string' || result.masked_destination.length > 254))) {
      throw new SignupFailure('이메일 인증 응답을 확인하지 못했습니다. 다시 시도해 주세요.', 'unexpected_signup');
    }
    return result;
  }
  startEmailVerification(email, intent) {
    return this.signupAction('start', intent, {email:email.trim().toLowerCase()}, ['code_sent','verified']);
  }
  confirmEmailVerification(intent, code) {
    if (!/^\d{6}$/.test(code.trim())) return Promise.reject(new SignupFailure('메일로 받은 6자리 인증 코드를 입력해 주세요.', 'invalid_code'));
    return this.signupAction('confirm', intent, {code:code.trim()}, 'verified');
  }
  resendEmailVerification(intent) {
    return this.signupAction('resend', intent, {}, ['code_sent','verified']);
  }
  completeRegistration(intent, password) {
    if (!signupPasswordRules(password).valid) return Promise.reject(new SignupFailure('비밀번호는 8~256자, 특수문자 1개 이상이며 공백 없이 입력해 주세요.', 'invalid_password'));
    return this.signupAction('complete', intent, {password}, 'complete');
  }
  logout() {
    if (this.pendingLogout) return this.pendingLogout;
    this.clearSession(true);
    sessionStorage.removeItem('web.oauth');
    sessionStorage.removeItem('web.activeScan');
    sessionStorage.removeItem('web.activeDeep');
    this.channel?.postMessage({type:'logout'});
    this.pendingLogout = this.withAuthLock(async () => {
      const result = await this.authRequest('logout', {});
      if (result?.logged_out !== true) throw new Error('로그아웃 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
    }, true).finally(() => {this.pendingLogout = null;});
    return this.pendingLogout;
  }
}
