// dsh-outline-ai 浏览器半区（单文件模块，无外部构建依赖）
//
// 职责：在 设置 → 插件 → 插件配置 注册一张配置卡片（settings.plugin.item 槽位，
// key = 'outline-ai' 命名空间），编辑 Outline 知识库连接的 baseUrl / apiToken。
// 卡片外观与官方卡片（终端 / Agent 循环 / 网页搜索）保持一致：可折叠头部 +
// chevron + 字段组 + 底部操作栏，样式使用同一套 --dsw-alias-* 主题变量。
// 数据经 settingsScope 服务写入宿主端 settings.yaml 的 outline-ai 命名空间，
// 宿主插件（lib/index.js）通过 installSettingsSection 读取，保存后实时生效。
window.__ModuleLoader__.load({
	id: "dsh-outline-ai",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		const React = require("react");

		// 字典命名空间与 settings 命名空间 / 槽位 key（三者同名便于定位）
		const NS = "settings.outlineAi";
		const NS_KEY = "outline-ai";

		// 与官方卡片一致的中文/英文文案（对齐 ui-settings-plugins locales）
		const zh = {
			cardTitle: "Outline 知识库",
			cardDescription: "在对话中搜索 / 读取公司 Outline 知识库文档（outline_search / outline_get_document）。",
			baseUrl: "服务地址 (baseUrl)",
			baseUrlHint: "Outline 实例根地址，如 https://outline.example.com",
			apiToken: "API Token",
			apiTokenHint: "Outline 设置 → API 密钥 中生成",
			overridden: "已覆盖",
			reset: "恢复默认",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			unsaved: "未保存",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			readOnly: "本部署的设置为只读。",
			expand: "展开设置",
			collapse: "收起设置",
			emptyPlaceholder: "留空表示使用默认值",
		};
		const en = {
			cardTitle: "Outline Knowledge Base",
			cardDescription: "Search / read company Outline knowledge base documents from conversations (outline_search / outline_get_document).",
			baseUrl: "Service URL (baseUrl)",
			baseUrlHint: "Outline instance root, e.g. https://outline.example.com",
			apiToken: "API Token",
			apiTokenHint: "Create one at Outline Settings → API keys",
			overridden: "Overridden",
			reset: "Reset",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			unsaved: "Unsaved",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			readOnly: "This deployment stores settings read-only.",
			expand: "Show settings",
			collapse: "Hide settings",
			emptyPlaceholder: "Leave empty to use the default",
		};

		const FIELDS = ["baseUrl", "apiToken"];

		/**
		 * 复刻官方 PluginCard.module.css / fields.module.css 的样式规则，
		 * 类名加 dsh-oac- 前缀避免冲突；颜色全部走 --dsw-alias-* 主题变量。
		 */
		const CSS_TEXT = [
			".dsh-oac-card{list-style:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}",
			".dsh-oac-card:hover{border-color:var(--dsw-alias-label-dimmed)}",
			".dsh-oac-open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}",
			".dsh-oac-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}",
			".dsh-oac-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}",
			".dsh-oac-headText{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}",
			".dsh-oac-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}",
			".dsh-oac-description{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}",
			".dsh-oac-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s}",
			".dsh-oac-chevronOpen{transform:rotate(180deg)}",
			".dsh-oac-pending{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}",
			".dsh-oac-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}",
			".dsh-oac-readOnly{margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}",
			".dsh-oac-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}",
			".dsh-oac-field+.dsh-oac-field{border-top:1px solid var(--dsw-alias-border-l2)}",
			".dsh-oac-head{display:flex;align-items:center;gap:8px}",
			".dsh-oac-label{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}",
			".dsh-oac-badges{display:inline-flex;align-items:center;gap:8px}",
			".dsh-oac-badge{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;font-weight:500;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}",
			".dsh-oac-reset{border:none;background:none;padding:0;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}",
			".dsh-oac-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}",
			".dsh-oac-reset:disabled{cursor:default}",
			".dsh-oac-input{height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}",
			".dsh-oac-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}",
			".dsh-oac-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}",
			".dsh-oac-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}",
			".dsh-oac-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2)}",
			".dsh-oac-failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error)}",
			".dsh-oac-discard,.dsh-oac-save{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer}",
			".dsh-oac-discard{border-color:var(--dsw-alias-border-l2);background:none;color:var(--dsw-alias-label-secondary)}",
			".dsh-oac-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}",
			".dsh-oac-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}",
			".dsh-oac-discard:disabled,.dsh-oac-save:disabled{opacity:.4;cursor:default}",
			".dsh-oac-discard:focus-visible,.dsh-oac-save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
		].join("\n");

		/** 注入一次样式（挂到 head，带 data-plugin 便于宿主按插件生命周期清理）。 */
		function injectStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-outline-ai-styles")) return;
			const style = document.createElement("style");
			style.id = "dsh-outline-ai-styles";
			style.setAttribute("data-plugin", "dsh-outline-ai");
			style.textContent = CSS_TEXT;
			document.head.appendChild(style);
		}

		/** 极简 SnapshotStore：getSnapshot/subscribe，满足槽位渲染器的 hooks 契约。 */
		function createStore(initial) {
			let snapshot = initial;
			const listeners = new Set();
			return {
				getSnapshot: () => snapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => { listeners.delete(listener); };
				},
				set: (next) => {
					if (next === snapshot) return;
					snapshot = next;
					for (const listener of [...listeners]) listener();
				},
			};
		}

		/**
		 * 卡片表单控制器：把 settingsScope 命名空间快照投影为卡片状态，
		 * 提供 edit/resetField/save/discard 动作（形状对齐官方 CardActions）。
		 */
		function createController(scope) {
			let draft = {}; // field -> { text, clear }
			let saving = false;
			let failed = false;
			const store = createStore(project());

			function fieldState(name) {
				const snap = scope.getSnapshot();
				const ready = snap.status === "ready";
				const value = (ready && snap.value) || {};
				const user = (ready && snap.user) || {};
				const staged = draft[name];
				const text = staged !== undefined ? staged.text : (ready ? String(value[name] ?? "") : "");
				const overridden = staged !== undefined ? !staged.clear : user[name] !== undefined;
				return { text, overridden, invalid: false };
			}

			function project() {
				const snap = scope.getSnapshot();
				const ready = snap.status === "ready";
				const out = {
					available: ready,
					writable: snap.writable !== false,
					dirty: Object.keys(draft).length > 0,
					invalid: false,
					saving,
					failed,
				};
				for (const name of FIELDS) out[name] = fieldState(name);
				return out;
			}

			function emit() { store.set(project()); }

			scope.subscribe(() => emit());

			return {
				store,
				actions: {
					edit: (name, text) => {
						draft[name] = { text, clear: text === "" };
						failed = false;
						emit();
					},
					resetField: (name) => {
						draft[name] = { text: "", clear: true };
						failed = false;
						emit();
					},
					discard: () => {
						draft = {};
						failed = false;
						emit();
					},
					save: () => {
						if (saving) return;
						const ops = [];
						for (const name of FIELDS) {
							const staged = draft[name];
							if (staged === undefined) continue;
							if (staged.clear) ops.push({ op: "unset", path: [name] });
							else if (staged.text !== "") ops.push({ op: "set", path: [name], value: staged.text });
						}
						if (ops.length === 0) return;
						saving = true;
						failed = false;
						emit();
						const run = async () => {
							for (const op of ops) {
								if (op.op === "set") await scope.set(op.path[0], op.value);
								else await scope.unset(op.path[0]);
							}
						};
						run().then(
							() => { draft = {}; saving = false; emit(); },
							() => { saving = false; failed = true; emit(); },
						);
					},
				},
			};
		}

		/** 与官方 IconChevronDownOutline14 同形的内联 chevron（避免依赖 primitives 包）。 */
		function ChevronIcon({ open }) {
			return React.createElement(
				"svg",
				{
					className: "dsh-oac-chevron" + (open ? " dsh-oac-chevronOpen" : ""),
					width: 14,
					height: 14,
					viewBox: "0 0 16 16",
					"aria-hidden": true,
				},
				React.createElement("path", {
					d: "M4 6l4 4 4-4",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.5,
					strokeLinecap: "round",
					strokeLinejoin: "round",
				}),
			);
		}

		/** 复刻官方 ValueField 的字段行。 */
		function ValueField(props) {
			return React.createElement(
				"div", { className: "dsh-oac-field" },
				React.createElement(
					"div", { className: "dsh-oac-head" },
					React.createElement("label", { className: "dsh-oac-label", htmlFor: props.id }, props.label),
					props.overridden
						? React.createElement(
							"span", { className: "dsh-oac-badges" },
							React.createElement("span", { className: "dsh-oac-badge" }, props.overriddenLabel),
							React.createElement("button", {
								type: "button",
								className: "dsh-oac-reset",
								disabled: props.disabled,
								onClick: props.onReset,
							}, props.resetLabel),
						)
						: null,
				),
				React.createElement("input", {
					id: props.id,
					className: "dsh-oac-input",
					type: props.password ? "password" : "text",
					value: props.text,
					placeholder: props.placeholder ?? "",
					autoComplete: props.password ? "off" : undefined,
					disabled: props.disabled,
					onChange: (event) => { props.onEdit(event.currentTarget.value); },
				}),
				React.createElement("p", { className: "dsh-oac-hint" }, props.hint),
			);
		}

		/** 复刻官方 PluginCard 的卡片外壳（可折叠头部 + 字段组 + 底部操作栏）。 */
		function OutlineCard(props) {
			const [open, setOpen] = React.useState(false);
			const state = props.useOutlineAiCard((s) => s);
			const t = props.t;
			if (!state.available) return null;
			const blocked = !state.dirty || state.invalid || state.saving;
			const title = t("cardTitle");

			return React.createElement(
				"li", { className: "dsh-oac-card" + (open ? " dsh-oac-open" : "") },
				React.createElement(
					"button",
					{
						type: "button",
						className: "dsh-oac-header",
						"aria-expanded": open,
						"aria-label": t(open ? "collapse" : "expand") + ": " + title,
						onClick: () => { setOpen(!open); },
					},
					React.createElement(
						"span", { className: "dsh-oac-headText" },
						React.createElement("span", { className: "dsh-oac-name" }, title),
						React.createElement("span", { className: "dsh-oac-description" }, t("cardDescription")),
					),
					state.dirty ? React.createElement("span", { className: "dsh-oac-pending" }, t("unsaved")) : null,
					React.createElement(ChevronIcon, { open }),
				),
				open
					? React.createElement(
						"div", { className: "dsh-oac-body" },
						!state.writable ? React.createElement("p", { className: "dsh-oac-readOnly", role: "status" }, t("readOnly")) : null,
						React.createElement(ValueField, {
							id: "outline-ai-baseUrl",
							label: t("baseUrl"),
							hint: t("baseUrlHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							text: state.baseUrl.text,
							overridden: state.baseUrl.overridden,
							placeholder: t("emptyPlaceholder"),
							disabled: !state.writable,
							onEdit: (text) => { props.edit("baseUrl", text); },
							onReset: () => { props.resetField("baseUrl"); },
						}),
						React.createElement(ValueField, {
							id: "outline-ai-apiToken",
							label: t("apiToken"),
							hint: t("apiTokenHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							text: state.apiToken.text,
							overridden: state.apiToken.overridden,
							placeholder: t("emptyPlaceholder"),
							password: true,
							disabled: !state.writable,
							onEdit: (text) => { props.edit("apiToken", text); },
							onReset: () => { props.resetField("apiToken"); },
						}),
						React.createElement(
							"div", { className: "dsh-oac-footer" },
							state.failed ? React.createElement("p", { className: "dsh-oac-failed", role: "status" }, t("saveFailed")) : null,
							React.createElement("button", {
								type: "button",
								className: "dsh-oac-discard",
								disabled: !state.dirty || state.saving,
								onClick: props.discard,
							}, t("discard")),
							React.createElement("button", {
								type: "button",
								className: "dsh-oac-save",
								disabled: blocked,
								onClick: props.save,
							}, t(state.saving ? "saving" : "save")),
						),
					)
					: null,
			);
		}

		function apply(ctx) {
			injectStyles();
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-outline-ai: settings card locale");
			const controller = createController(ctx.settingsScope.bind({ namespace: NS_KEY }));
			ctx.slots.register({
				name: "settings.plugin.item",
				id: "outline-ai",
				key: NS_KEY,
				order: 30,
				locale: NS,
				inject: () => ({ hooks: { outlineAiCard: controller.store }, ...controller.actions }),
			}, OutlineCard);
		}

		const inject = ["slots", "locale", "settingsScope"];

		exports.name = "dsh-outline-ai";
		exports.inject = inject;
		exports.apply = apply;
		exports.internals = Object.freeze({
			OutlineCard,
			ValueField,
			createController,
			createStore,
			CSS_TEXT,
			zh,
			en,
		});
		return module.exports;
	}
});
