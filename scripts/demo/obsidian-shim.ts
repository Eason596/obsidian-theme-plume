import { renderDemoMarkdown } from "./demo-markdown";

export type IconName = string;

export class Component {
  private cleanups: Array<() => void> = [];

  addChild(_child: unknown): void {
    /* demo */
  }

  register(cb: () => void): void {
    this.cleanups.push(cb);
  }
}

export class MarkdownRenderChild extends Component {
  constructor(public containerEl: HTMLElement) {
    super();
  }
}

export class Notice {
  constructor(_message: string) {
    /* demo */
  }
}

export class App {
  workspace = {
    trigger: (_name: string): void => {
      /* demo */
    }
  };
}

export type MarkdownPostProcessorContext = {
  addChild: (child: MarkdownRenderChild) => void;
};

export function getIconIds(): string[] {
  return [];
}

export function setIcon(host: HTMLElement, _name: string): void {
  host.textContent = host.textContent || "•";
  host.classList.add("demo-icon-fallback");
}

export async function requestUrl(request: {
  url: string;
  method?: string;
}): Promise<{ json: unknown; status: number }> {
  const response = await fetch(request.url, { method: request.method ?? "GET" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${request.url}`);
  }
  return { json: await response.json(), status: response.status };
}

export class MarkdownRenderer {
  static async render(
    _app: App,
    markdown: string,
    container: HTMLElement,
    _sourcePath: string,
    _component: Component
  ): Promise<void> {
    await renderDemoMarkdown(container, markdown);
  }
}
