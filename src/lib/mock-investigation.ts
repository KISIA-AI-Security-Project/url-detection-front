import type {
  ActionKind,
  InvestigationAction,
  InvestigationSnapshot,
  InvestigationTask,
  InvestigationWork,
  StepState,
} from "./types";

/** Replace with the backend's SSE stream (EventSource) when it is ready.
 * The mock replays a fixed script against the stored start time, so a reload
 * resumes where the run is instead of restarting it. Nothing is fetched. */
const PREFIX = "linkguard.v1.investigation.";
const TICK_MS = 700;

interface StoredRun {
  id: string;
  url: string;
  startedAt: number;
}

interface ScriptTask {
  id: string;
  title: string;
  agent: string | null;
  actions: Omit<InvestigationAction, "id">[];
}
interface ScriptWork {
  id: string;
  title: string;
  question: string;
  reason: string;
  assignedAt: number;
  tasks: ScriptTask[];
  doneAt?: number;
  stoppedAt?: number;
  answer?: string;
}

const FINAL_URL =
  "https://account-verify.example/auth/session?source=redirect&continue=%2Faccount%2Fverification%2Fconfirm";
const FIRST_WORK_AT = 3000;
const FINALIZE_AT = 18000;
const SAVED_AT = 20000;

function script(url: string): ScriptWork[] {
  return [
    {
      id: "credential",
      title: "로그인 정보 전송 위치 확인",
      question: "입력한 로그인 정보가 외부 도메인으로 전송되는가?",
      reason:
        "빠른 분석에서 로그인 폼의 전송 대상이 외부 도메인으로 확인됐습니다.",
      assignedAt: FIRST_WORK_AT,
      doneAt: 11500,
      answer: "시험용 로그인 정보가 collect-account.example로 전송됐습니다.",
      tasks: [
        {
          id: "credential-submit",
          title: "시험용 정보로 로그인 시도",
          agent: "브라우저 Agent",
          actions: [
            {
              kind: "open",
              at: 3500,
              summary: "분석 URL을 격리 브라우저에서 열었습니다.",
              value: url,
            },
            {
              kind: "navigate",
              at: 5000,
              summary: "3회 이동한 뒤 최종 페이지에 도착했습니다.",
              value: FINAL_URL,
            },
            {
              kind: "observe",
              at: 7000,
              summary: "아이디·비밀번호 입력란과 로그인 버튼이 있습니다.",
            },
            {
              kind: "tool",
              at: 9000,
              tool: "fill_form · submit",
              summary: "제출 요청이 외부 도메인으로 POST 전송됐습니다.",
              value: "https://collect-account.example/api/session",
            },
            {
              kind: "report",
              at: 11000,
              summary:
                "시험용 계정 정보가 외부 도메인으로 전송되는 것을 확인했습니다.",
            },
          ],
        },
      ],
    },
    {
      id: "screen",
      title: "현재 화면 확인",
      question: "최종 화면이 공식 서비스의 로그인 화면을 모방하는가?",
      reason: "빠른 분석에서 공식 서비스와 유사한 화면 요소가 확인됐습니다.",
      assignedAt: 6000,
      doneAt: 15500,
      answer:
        "공식 서비스의 로고와 문구를 사용하지만 도메인은 일치하지 않습니다.",
      tasks: [
        {
          id: "screen-compare",
          title: "화면 캡처 후 공식 화면과 비교",
          agent: "화면 분석 Agent",
          actions: [
            {
              kind: "open",
              at: 6500,
              summary: "최종 페이지를 열었습니다.",
              value: FINAL_URL,
            },
            {
              kind: "navigate",
              at: 8000,
              summary: "추가 이동 없이 페이지가 열렸습니다.",
            },
            {
              kind: "observe",
              at: 10000,
              summary: "공식 서비스와 같은 로고·안내 문구가 보입니다.",
            },
            {
              kind: "tool",
              at: 13000,
              tool: "screenshot_compare",
              summary: "공식 로그인 화면과 레이아웃이 거의 같습니다.",
            },
            {
              kind: "report",
              at: 15000,
              summary: "공식 서비스 로그인 화면을 모방한 구성으로 보입니다.",
            },
          ],
        },
      ],
    },
    {
      id: "follow-up",
      title: "로그인 이후 동작 확인",
      question: "로그인 이후 추가 정보 입력이나 파일 다운로드를 유도하는가?",
      reason: "최종 URL의 continue 값이 추가 인증 단계를 가리킵니다.",
      assignedAt: 12000,
      stoppedAt: 17000,
      tasks: [
        {
          id: "follow-up-walk",
          title: "로그인 이후 화면 따라가기",
          agent: "브라우저 Agent",
          actions: [
            {
              kind: "open",
              at: 12500,
              summary: "로그인 이후 이어지는 페이지를 열었습니다.",
            },
            {
              kind: "navigate",
              at: 14000,
              summary: "추가 인증 화면으로 이동했습니다.",
              value:
                "https://account-verify.example/account/verification/confirm",
            },
            {
              kind: "observe",
              at: 16000,
              summary: "카드 정보 입력을 요구하는 화면입니다.",
            },
          ],
        },
        {
          id: "follow-up-download",
          title: "다운로드 링크 확인",
          agent: null,
          actions: [],
        },
      ],
    },
  ];
}

const ACTION_PHRASES: Record<ActionKind, string> = {
  open: "페이지 여는 중",
  navigate: "이동 결과 확인 중",
  observe: "화면 살펴보는 중",
  tool: "도구 실행 결과 확인 중",
  report: "결과 정리 중",
};

function snapshotAt(run: StoredRun, now: number): InvestigationSnapshot {
  const elapsed = Math.max(0, now - run.startedAt);
  const works: InvestigationWork[] = script(run.url)
    .filter((work) => work.assignedAt <= elapsed)
    .map((work) => {
      const state: StepState =
        work.doneAt !== undefined && work.doneAt <= elapsed
          ? "done"
          : work.stoppedAt !== undefined && work.stoppedAt <= elapsed
            ? "stopped"
            : "running";
      const tasks: InvestigationTask[] = work.tasks.map((task) => {
        const actions = task.actions
          .filter((action) => action.at <= elapsed)
          .map((action, index) => ({ ...action, id: `${task.id}-${index}` }));
        const complete =
          task.actions.length > 0 && actions.length === task.actions.length;
        return {
          id: task.id,
          title: task.title,
          agent: task.agent,
          actions,
          state:
            state === "done" || complete
              ? "done"
              : state === "stopped"
                ? "stopped"
                : actions.length
                  ? "running"
                  : "pending",
        };
      });
      const latest = tasks
        .flatMap((task) => task.actions)
        .sort((a, b) => b.at - a.at)[0];
      return {
        id: work.id,
        title: work.title,
        question: work.question,
        reason: work.reason,
        state,
        statusText:
          state === "done"
            ? "완료"
            : state === "stopped"
              ? "확인 중단 · 결과 충분"
              : latest
                ? ACTION_PHRASES[latest.kind]
                : "작업 준비 중",
        tasks,
        answer: state === "done" ? work.answer : undefined,
      };
    });
  const phase = (start: number, end: number): StepState =>
    elapsed >= end ? "done" : elapsed >= start ? "running" : "pending";
  const overall = [
    {
      key: "collect" as const,
      label: "자료 확인",
      state: phase(0, FIRST_WORK_AT),
    },
    {
      key: "work" as const,
      label: "업무 수행",
      state: phase(FIRST_WORK_AT, FINALIZE_AT),
    },
    {
      key: "finalize" as const,
      label: "최종 결과 정리",
      state: phase(FINALIZE_AT, SAVED_AT),
    },
    {
      key: "saved" as const,
      label: "결과 저장 완료",
      state: elapsed >= SAVED_AT ? ("done" as const) : ("pending" as const),
    },
  ];
  const done = elapsed >= SAVED_AT;
  return {
    id: run.id,
    url: run.url,
    startedAt: run.startedAt,
    elapsed,
    overall,
    overallText: done
      ? "결과 저장 완료"
      : elapsed >= FINALIZE_AT
        ? "최종 결과 정리 중"
        : elapsed >= FIRST_WORK_AT
          ? "업무 수행 중"
          : "자료 확인 중",
    works,
    final: done
      ? {
          tone: "danger",
          headline: "이 링크에 접속하거나 로그인 정보를 입력하지 마세요.",
          summary:
            "직접 접속해 확인한 결과, 입력한 계정 정보를 외부로 빼돌리는 피싱 페이지입니다.",
          points: [
            "시험용 로그인 정보가 collect-account.example로 전송됐습니다.",
            "최종 화면은 공식 서비스의 로고와 문구를 사용하지만 도메인이 다릅니다.",
            "앞선 두 결과로 판단이 충분해 로그인 이후 동작 확인은 중단했습니다.",
          ],
        }
      : null,
    done,
  };
}

function read(id: string): StoredRun | null {
  try {
    const data = JSON.parse(localStorage.getItem(`${PREFIX}${id}`) || "null");
    if (
      !data ||
      data.id !== id ||
      typeof data.url !== "string" ||
      !Number.isFinite(data.startedAt)
    )
      return null;
    return data as StoredRun;
  } catch {
    return null;
  }
}

export const investigationService = {
  start(url: string): StoredRun {
    const run = { id: crypto.randomUUID(), url, startedAt: Date.now() };
    localStorage.setItem(`${PREFIX}${run.id}`, JSON.stringify(run));
    return run;
  },
  /** SSE stand-in: pushes a fresh snapshot right away, then every tick until
   * the run is saved. Returns an unsubscribe function. `null` = unknown run. */
  subscribe(
    id: string,
    onUpdate: (snapshot: InvestigationSnapshot | null) => void,
  ): () => void {
    const run = read(id);
    if (!run) {
      onUpdate(null);
      return () => {};
    }
    const push = () => {
      const snapshot = snapshotAt(run, Date.now());
      onUpdate(snapshot);
      if (snapshot.done) window.clearInterval(timer);
    };
    const timer = window.setInterval(push, TICK_MS);
    push();
    return () => window.clearInterval(timer);
  },
};
