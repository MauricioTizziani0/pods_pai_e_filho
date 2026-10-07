import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

function load(file, dependencies) {
  const compiledModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module: compiledModule, exports: compiledModule.exports, require(name) {
    if (name === "react/jsx-runtime") return jsx;
    if (name in dependencies) return dependencies[name];
    throw new Error(name);
  } });
  return compiledModule.exports;
}
function walk(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => walk(item, result));
  else if (node?.props) { result.push(node); walk(node.props.children, result); }
  return result;
}
function Link() {}
let pathname = "/inicio";
let canWrite = true;
const ui = new Proxy({}, { get: (_, name) => ({ [name]: function () {} })[name] });
const { AppShell } = load("components/shell/app-shell.tsx", {
  "next/link": { default: Link }, "next/navigation": { usePathname: () => pathname, useRouter: () => ({}) },
  "lucide-react": ui, "@/lib/supabase/client": {}, "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  "@/components/brand/logo": ui,
});
function render() {
  return AppShell({ profile: { full_name: "Pessoa de teste", role_name: canWrite ? "Admin" : "CONSULTAS", can_write: canWrite }, children: null });
}
function mobile(tree) { return walk(tree).find((element) => element.props["aria-label"] === "Navegação mobile"); }
function links(tree) { return walk(mobile(tree)).filter((element) => element.type === Link); }
function labels(tree) { return links(tree).map((link) => walk(link).find((element) => typeof element.props.children === "string").props.children); }
let tree = render();
assert.deepEqual(labels(tree), ["Início", "Estoque", "Vender", "Financeiro", "Mais"]);
assert.equal(links(tree)[2].props.href, "/vendas/nova");
assert.ok(mobile(tree).props.children.props.className.includes("grid-cols-5"));
assert.ok(links(tree).every((link) => link.props.className.includes("h-16") && link.props.className.includes("pb-2") && !link.props.className.includes("-mt-4")));
assert.ok(walk(tree).find((element) => element.type === "aside").props.children);
for (pathname of ["/lotes", "/lotes/lote-8", "/mais", "/produtos", "/vendas/venda-1"]) {
  assert.equal(links(render()).find((link) => link.props["aria-current"] === "page").props.href, "/mais");
}
pathname = "/vendas/nova";
assert.equal(links(render()).filter((link) => link.props["aria-current"] === "page").length, 1);
assert.equal(links(render()).find((link) => link.props["aria-current"] === "page").props.href, "/vendas/nova");
canWrite = false;
pathname = "/vendas";
assert.deepEqual(labels(render()), ["Início", "Estoque", "Vendas", "Financeiro", "Mais"]);
assert.equal(links(render()).find((link) => link.props["aria-current"] === "page").props.href, "/vendas");
const { default: MaisPage } = load("app/(painel)/mais/page.tsx", {
  "next/link": { default: Link }, "lucide-react": ui,
  "@/lib/auth": { getSessionState: async () => ({ status: "ok", profile: { can_write: canWrite } }) },
  "@/components/logout-button": ui, "@/components/brand/logo": ui, "@/components/ui/badge": ui,
});
for (canWrite of [true, false]) {
  assert.equal(walk(await MaisPage()).filter((element) => element.type === Link && element.props.href === "/lotes").length, 1);
}
console.log("Navegação mobile conferida: cinco itens, Vender central, Lotes em Mais, destaque e permissões.");
