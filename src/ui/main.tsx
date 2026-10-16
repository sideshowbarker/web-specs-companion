import '../shared/browser.ts';
import { render } from 'preact';
import { App } from './App.tsx';

const surface = document.documentElement.dataset.surface === 'sidepanel' ? 'sidepanel' : 'popup';
render(<App surface={surface} />, document.getElementById('app')!);
