import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {WebAuth} from '../src/service/session-auth.js';

const config = {domain:'https://example.auth.ap-northeast-2.amazoncognito.com',client_id:'public-client',redirect_uri:'https://service.example/',scope:'openid email team5-web/analysis'};
let stored: Map<string,string>;
let popup: any;
let open: ReturnType<typeof vi.fn>;
const active = (ref = 'A'.repeat(43)) => ({authenticated:true,access_token:'access-memory',expires_at:Date.now()+3600000,session_ref:ref});
const logout = () => ({logged_out:true,logout_url:config.domain+'/logout?'+new URLSearchParams({client_id:config.client_id,logout_uri:config.redirect_uri})});
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)});
  vi.stubGlobal('BroadcastChannel',undefined);
  vi.stubGlobal('location',{origin:'https://service.example',pathname:'/',search:'',replace:vi.fn(),assign:vi.fn()});
  vi.stubGlobal('history',{replaceState:vi.fn()});
  popup = {closed:false,close:vi.fn(()=>{popup.closed=true;}),location:{replace:vi.fn()}};
  open = vi.fn(()=>popup);
  vi.stubGlobal('window',{open,opener:null,close:vi.fn()});
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

describe('native same-page sessions',()=>{
  it('continues the initial binding once and never retries an ambiguous provider failure',async()=>{
    const mock=vi.fn().mockResolvedValueOnce(Response.json({code:'signin_binding_required'},{status:409})).mockResolvedValueOnce(Response.json(active()));vi.stubGlobal('fetch',mock);
    await new WebAuth(config).login('test@example.test','old');expect(mock).toHaveBeenCalledTimes(2);
    mock.mockReset().mockRejectedValue(new Error('network'));await expect(new WebAuth(config).login('test@example.test','old')).rejects.toThrow('network');expect(mock).toHaveBeenCalledOnce();
  });
  it('does not continue an anonymous binding after logout',async()=>{
    let finish!: (value:Response)=>void;const mock=vi.fn((url:string)=>url.endsWith('/signin')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(Response.json(logout())));vi.stubGlobal('fetch',mock);
    const auth=new WebAuth(config);const pending=auth.login('test@example.test','old');const rejected=expect(pending).rejects.toThrow();await auth.logout();finish(Response.json({code:'signin_binding_required'},{status:409}));await rejected;expect(mock).toHaveBeenCalledTimes(2);expect(auth.tokens).toBeNull();
  });

  it('posts credentials once, keeps the password verbatim, and opens no window',async()=>{
    const fetchMock=vi.fn(async()=>Response.json(active()));vi.stubGlobal('fetch',fetchMock);stored.set('web.auth.signedOut','1');
    const auth=new WebAuth(config);await auth.login(' Test@Example.test ',' old password ');
    expect(fetchMock).toHaveBeenCalledOnce();expect(fetchMock).toHaveBeenCalledWith('/api/auth/signin',expect.objectContaining({method:'POST',credentials:'same-origin',body:JSON.stringify({email:'test@example.test',password:' old password '})}));
    expect(auth.tokens?.access_token).toBe('access-memory');expect(stored.size).toBe(0);expect(open).not.toHaveBeenCalled();expect(location.assign).not.toHaveBeenCalled();expect(location.replace).not.toHaveBeenCalled();
  });
  it('restores a refreshed document through the cookie without browser token storage',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json(active())));const auth=new WebAuth(config);expect(await auth.initialize()).toBe(true);expect(await new WebAuth(config).initialize()).toBe(true);
    expect(await auth.accessToken()).toBe('access-memory');expect(stored.size).toBe(0);expect(open).not.toHaveBeenCalled();
  });
  it('leaves anonymous visitors at entry',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({authenticated:false})));expect(await new WebAuth(config).initialize()).toBe(false);expect(open).not.toHaveBeenCalled();});
  it('does not use signup password rules for existing credentials',async()=>{
    const mock=vi.fn(async()=>Response.json(active()));vi.stubGlobal('fetch',mock);const auth=new WebAuth(config);
    await expect(auth.login('test@example.test','')).rejects.toThrow('입력');expect(mock).not.toHaveBeenCalled();await auth.login('test@example.test','old');expect(mock).toHaveBeenCalledOnce();
  });
  it('invalid credentials cannot restore an old session or lose local sign-out',async()=>{
    const mock=vi.fn(async()=>Response.json({code:'invalid_credentials',message:'이메일 또는 비밀번호를 확인해 주세요.'},{status:401}));vi.stubGlobal('fetch',mock);stored.set('web.auth.signedOut','1');const auth=new WebAuth(config);const notified=vi.fn();auth.subscribe(notified);
    await expect(auth.login('test@example.test','wrong')).rejects.toThrow('비밀번호');expect(auth.tokens).toBeNull();expect((auth as any).pendingLogin).toBeNull();expect(stored.get('web.auth.signedOut')).toBe('1');expect(mock).toHaveBeenCalledOnce();expect(notified).not.toHaveBeenCalled();
  });
  it('coalesces duplicate signin requests',async()=>{
    let finish!: (value:Response)=>void;const mock=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',mock);const auth=new WebAuth(config);
    const a=auth.login('test@example.test','old'),b=auth.login('test@example.test','old');expect(a).toBe(b);expect(mock).toHaveBeenCalledOnce();finish(Response.json(active()));await a;
  });
  it('another tab lock prevents credentials from being submitted',async()=>{
    vi.stubGlobal('navigator',{locks:{request:vi.fn(async(_n:string,o:any,cb:any)=>{expect(o).toEqual({mode:'exclusive',ifAvailable:true});return cb(null);})}});
    const mock=vi.fn();vi.stubGlobal('fetch',mock);await expect(new WebAuth(config).login('test@example.test','old')).rejects.toThrow('다른 탭');expect(mock).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();
  });
  it('ignores a late signin response after logout',async()=>{
    let finish!: (value:Response)=>void;vi.stubGlobal('fetch',vi.fn((url:string)=>url.endsWith('/signin')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(Response.json(logout()))));
    const auth=new WebAuth(config);const pending=auth.login('test@example.test','old');const rejected=expect(pending).rejects.toThrow();await auth.logout();finish(Response.json(active()));await rejected;
    expect(auth.tokens).toBeNull();expect(stored.get('web.auth.signedOut')).toBe('1');expect(open).not.toHaveBeenCalled();
  });
  it('logout clears immediately while waiting for the browser auth lock',async()=>{
    let grant!:()=>Promise<unknown>;vi.stubGlobal('navigator',{locks:{request:vi.fn((_n:string,o:any,cb:any)=>{expect(o).toEqual({mode:'exclusive'});return new Promise((resolve,reject)=>{grant=()=>Promise.resolve(cb({})).then(resolve,reject);});})}});
    const mock=vi.fn(async()=>Response.json(logout()));vi.stubGlobal('fetch',mock);const auth=new WebAuth(config);auth.tokens=active() as any;const pending=auth.logout();expect(auth.tokens).toBeNull();expect(mock).not.toHaveBeenCalled();await expect(auth.accessToken()).rejects.toThrow('로그인');await grant();await pending;expect(open).not.toHaveBeenCalled();
  });
  it('logout failure stays signed out and is visible to the caller',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({message:'서버 연결을 확인해 주세요.'},{status:503})));const auth=new WebAuth(config);auth.tokens=active() as any;await expect(auth.logout()).rejects.toThrow('서버');expect(auth.tokens).toBeNull();await expect(auth.accessToken()).rejects.toThrow('로그인');expect(open).not.toHaveBeenCalled();
  });
  it('blocks a new signin until logout finishes',async()=>{
    let finish!: (value:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));const auth=new WebAuth(config);const pending=auth.logout();await expect(auth.login('test@example.test','old')).rejects.toThrow('로그아웃 처리 중');finish(Response.json(logout()));await pending;
  });
  it('does not replay an old tab logout on reload against a newer shared session',async()=>{
    stored.set('web.auth.signedOut','1');const mock=vi.fn(async(_url:string)=>Response.json(active('B'.repeat(43))));vi.stubGlobal('fetch',mock);expect(await new WebAuth(config).initialize()).toBe(false);expect(mock).toHaveBeenCalledOnce();expect(mock.mock.calls[0][0]).toBe('/api/auth/session');
  });
  it('invalidates a delayed restore after logout',async()=>{
    let finish!: (value:Response)=>void;vi.stubGlobal('fetch',vi.fn((url:string)=>url.endsWith('/session')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(Response.json(logout()))));const auth=new WebAuth(config);const initial=auth.initialize();const rejected=expect(initial).rejects.toThrow();await auth.logout();finish(Response.json(active()));await rejected;expect(auth.tokens).toBeNull();
  });
  it('coalesces refresh and retries only the server refresh lease',async()=>{
    vi.useFakeTimers();let n=0;const mock=vi.fn(async()=>++n===1?Response.json({code:'session_refreshing'},{status:409}):Response.json(active()));vi.stubGlobal('fetch',mock);const auth=new WebAuth(config);const a=auth.accessToken(),b=auth.accessToken();await vi.advanceTimersByTimeAsync(300);expect(await a).toBe('access-memory');expect(await b).toBe('access-memory');expect(mock).toHaveBeenCalledTimes(2);
  });
});
describe('email-first API contract',()=>{
  const intent='A'.repeat(43);
  it('prevents overlapping anonymous starts and sign-in while the first delivery request is pending',async()=>{
    let finish!: (value:Response)=>void;
    const fetchMock=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetchMock);
    const auth=new WebAuth(config);const first=auth.startEmailVerification('first@example.test',intent);
    await expect(auth.startEmailVerification('second@example.test','B'.repeat(43))).rejects.toMatchObject({code:'signup_request_pending'});
    await expect(auth.login('test@example.test','old')).rejects.toThrow('이메일 인증 요청');expect(open).not.toHaveBeenCalled();expect(fetchMock).toHaveBeenCalledOnce();
    finish(Response.json({intent_id:intent,status:'code_sent',email:'first@example.test',expires_at:Date.now()+900000,retry_after_seconds:0}));await first;
  });
  it('blocks email verification during unfinished signin',async()=>{
    let finish!: (value:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
    const auth=new WebAuth(config);const pending=auth.login('test@example.test','old');
    await expect(auth.startEmailVerification('test@example.test',intent)).rejects.toMatchObject({code:'auth_request_pending'});
    finish(Response.json(active()));await pending;expect(open).not.toHaveBeenCalled();
  });
  it('starts with only email and intent, then confirms and sets the password once',async()=>{
    const statuses=['code_sent','verified','complete'];const fetchMock=vi.fn(async()=>Response.json({intent_id:intent,status:statuses.shift(),email:'test@example.test',expires_at:Date.now()+900000,retry_after_seconds:0,login_required:true}));vi.stubGlobal('fetch',fetchMock);
    const auth=new WebAuth(config);
    await auth.startEmailVerification(' Test@Example.test ',intent);await auth.confirmEmailVerification(intent,'012345');await auth.completeRegistration(intent,'abcdefg!');
    const bodies=fetchMock.mock.calls.map(([,init]:any)=>JSON.parse(init.body));
    expect(bodies).toEqual([{intent_id:intent,email:'test@example.test'},{intent_id:intent,code:'012345'},{intent_id:intent,password:'abcdefg!'}]);
    expect(auth.tokens).toBeNull();expect(stored.size).toBe(0);
  });
  it('rejects mismatched flow responses and invalid password/code before requests',async()=>{
    const fetchMock=vi.fn(async()=>Response.json({intent_id:'different',status:'code_sent'}));vi.stubGlobal('fetch',fetchMock);const auth=new WebAuth(config);
    await expect(auth.startEmailVerification('test@example.test',intent)).rejects.toMatchObject({code:'unexpected_signup'});
    await expect(auth.confirmEmailVerification(intent,'00000x')).rejects.toMatchObject({code:'invalid_code'});
    await expect(auth.completeRegistration(intent,'abc defg!')).rejects.toMatchObject({code:'invalid_password'});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('accepts an idempotent start that is already verified by the server',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({intent_id:intent,status:'verified',email:'test@example.test',expires_at:Date.now()+900000,retry_after_seconds:0})));
    expect((await new WebAuth(config).startEmailVerification('test@example.test',intent)).status).toBe('verified');
  });
  it('accepts a resend whose flow was already verified by the server',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({intent_id:intent,status:'verified',email:'test@example.test',expires_at:Date.now()+900000,retry_after_seconds:0})));
    expect((await new WebAuth(config).resendEmailVerification(intent)).status).toBe('verified');
  });
  it('preserves rate-limit delay and rejects invalid delivery metadata',async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(Response.json({code:'rate_limited',message:'잠시 후 다시 시도해 주세요.',retry_after_seconds:38},{status:429})).mockResolvedValueOnce(Response.json({intent_id:intent,status:'code_sent',email:'test@example.test',expires_at:'invalid',retry_after_seconds:0}));vi.stubGlobal('fetch',fetchMock);
    const auth=new WebAuth(config);
    await expect(auth.startEmailVerification('test@example.test',intent)).rejects.toMatchObject({code:'rate_limited',retry_after_seconds:38});
    await expect(auth.startEmailVerification('test@example.test',intent)).rejects.toMatchObject({code:'unexpected_signup'});
  });
});
