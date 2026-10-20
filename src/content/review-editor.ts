// The comment editor: A panel below the selection, in a shadow root so no page style reaches it, which shows where the
// quote is and what it says, and takes the comment's kind, title, and text.
import { KIND_NAMES, KINDS, type Kind } from '../logic/review.ts';

export interface EditorValues {
  kind: Kind;
  title: string;
  text: string;
}

export interface EditorInit extends EditorValues {
  label: string;
  excerpt: string;
  editing: boolean;
  canFile: boolean;
}

export interface EditorActions {
  save(values: EditorValues): void;
  file(values: EditorValues): void;
  cancel(): void;
  remove(): void;
}

export const EDITOR_WIDTH = 380;

const EDITOR_CSS = `
:host { all: initial; position: absolute; z-index: 2147483647; }
[role="dialog"] {
  box-sizing: border-box; width: ${EDITOR_WIDTH}px; display: grid; gap: 8px; padding: 10px 12px;
  font: 13px/1.45 system-ui, sans-serif; color: #1a1a1a; background: #fff;
  border: 1px solid #9cc3e3; border-radius: 6px; box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
}
p { margin: 0; }
.where { font-weight: 600; }
.excerpt {
  padding-inline-start: 8px; border-inline-start: 3px solid #9cc3e3; color: #555b61; white-space: pre-wrap;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
}
.kinds { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.kinds label { display: inline-flex; align-items: center; gap: 4px; }
input[type="text"], textarea {
  box-sizing: border-box; width: 100%; padding: 4px 6px; font: inherit; color: inherit; background: inherit;
  border: 1px solid #9cc3e3; border-radius: 4px;
}
textarea { min-height: 7em; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }
button {
  padding: 3px 10px; font: inherit; color: #005a9c; background: #e8f1f8; border: 1px solid #9cc3e3; border-radius: 4px;
  cursor: pointer;
}
button:disabled { opacity: 0.5; cursor: default; }
.delete { margin-inline-start: auto; }
.note:empty { display: none; }
:focus-visible { outline: 3px solid #f9dc4a; outline-offset: 1px; }
@media (prefers-color-scheme: dark) {
  [role="dialog"] { color: #e8ecf0; background: #11161c; border-color: #2c5a85; }
  .excerpt { color: #a9b3bd; border-color: #2c5a85; }
  input[type="text"], textarea { border-color: #2c5a85; }
  button { color: #8cc4ff; background: #10263a; border-color: #2c5a85; }
}`;

export class CommentEditor {
  readonly host: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private noteLine: HTMLElement;

  constructor(doc: Document, init: EditorInit, actions: EditorActions) {
    this.host = doc.createElement('div');
    this.host.setAttribute('data-wsc-review', 'editor');
    const root = this.host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = EDITOR_CSS;
    const dialog = doc.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', `Comment on ${init.label}`);

    const where = doc.createElement('p');
    where.className = 'where';
    where.textContent = init.label;
    const excerpt = doc.createElement('p');
    excerpt.className = 'excerpt';
    excerpt.textContent = init.excerpt;
    excerpt.title = init.excerpt;

    let kind = init.kind;
    const kinds = doc.createElement('div');
    kinds.className = 'kinds';
    kinds.setAttribute('role', 'radiogroup');
    kinds.setAttribute('aria-label', 'Kind');
    const radios: HTMLInputElement[] = [];
    for (const k of KINDS) {
      const label = doc.createElement('label');
      const radio = doc.createElement('input');
      radio.type = 'radio';
      radio.name = 'kind';
      radio.value = k;
      radio.checked = k === kind;
      radio.addEventListener('click', () => {
        kind = k;
        for (const other of radios) other.checked = other === radio;
      });
      radios.push(radio);
      label.append(radio, KIND_NAMES[k].one);
      kinds.append(label);
    }

    const title = doc.createElement('input');
    title.type = 'text';
    title.setAttribute('aria-label', 'Title');
    title.placeholder = 'Title (for the issue)';
    title.value = init.title;
    this.textarea = doc.createElement('textarea');
    this.textarea.setAttribute('aria-label', 'Comment');
    this.textarea.placeholder = 'Your comment, in Markdown';
    this.textarea.value = init.text;

    const values = (): EditorValues => ({ kind, title: title.value, text: this.textarea.value });
    const button = (text: string, onClick: () => void, className = '') => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.textContent = text;
      if (className) b.className = className;
      b.addEventListener('click', onClick);
      return b;
    };
    const save = button('Save', () => actions.save(values()));
    const actionsRow = doc.createElement('div');
    actionsRow.className = 'actions';
    actionsRow.append(save);
    if (init.canFile) actionsRow.append(button('File issue', () => actions.file(values())));
    actionsRow.append(button('Cancel', () => actions.cancel()));
    if (init.editing) actionsRow.append(button('Delete', () => actions.remove(), 'delete'));
    // A comment needs a title or some text.
    const update = () => {
      save.disabled = !title.value.trim() && !this.textarea.value.trim();
    };
    title.addEventListener('input', update);
    this.textarea.addEventListener('input', update);
    update();

    this.noteLine = doc.createElement('p');
    this.noteLine.className = 'note';
    this.noteLine.setAttribute('aria-live', 'polite');

    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        actions.cancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !save.disabled) {
        e.preventDefault();
        actions.save(values());
      }
    });
    dialog.append(where, excerpt, kinds, title, this.textarea, actionsRow, this.noteLine);
    root.append(style, dialog);
  }

  placeAt(top: number, left: number): void {
    this.host.style.top = `${top}px`;
    this.host.style.left = `${left}px`;
  }

  focus(): void {
    this.textarea.focus();
  }

  note(message: string): void {
    this.noteLine.textContent = message;
  }

  close(): void {
    this.host.remove();
  }
}
