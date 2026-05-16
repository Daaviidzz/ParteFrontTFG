import fs from 'fs';
import vm from 'vm';

export function loadClassicScript(paths, expression, extraGlobals = {}) {
  const code = paths.map(path => fs.readFileSync(path, 'utf-8')).join('\n');
  const fn = new Function(
    ...Object.keys(extraGlobals),
    `${code}\nreturn ${expression};`
  );
  return fn(...Object.values(extraGlobals));
}

export function loadClassicScriptInContext(paths, expression, extraGlobals = {}) {
  const code = paths.map(path => fs.readFileSync(path, 'utf-8')).join('\n');
  const context = vm.createContext({
    console,
    Math,
    Date,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    BroadcastChannel: globalThis.BroadcastChannel,
    ...extraGlobals,
  });
  return vm.runInContext(`${code}\n${expression}`, context);
}
