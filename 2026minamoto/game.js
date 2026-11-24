(() => {
  "use strict";

  const { characters, routes } = window.GAME_DATA;
  const storageKey = "kamakura-romance-v1";
  const slotCount = 3;
  const locations = { hachimangu: "鶴岡八幡宮", gosho: "御所", yuigahama: "由比ヶ浜" };
  const expressions = { normal: "通常", happy: "喜び", angry: "怒り", sad: "悲しみ" };
  const endings = {
    happy: { label: "ハッピーエンド", condition: "好感度80%以上" },
    normal: { label: "ノーマルエンド", condition: "好感度40〜79%" },
    bad: { label: "バッドエンド", condition: "好感度39%以下" }
  };
  const endingIds = Object.keys(characters).flatMap(route => Object.keys(endings).map(kind => endingId(route, kind)));
  const optionsOrder = [
    [1, 3, 0, 2], [2, 0, 1, 3], [3, 1, 2, 0],
    [0, 2, 3, 1], [1, 0, 2, 3], [2, 3, 1, 0]
  ];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" });
  const byId = id => document.getElementById(id);
  const screens = [...document.querySelectorAll(".screen")];
  const dialog = byId("slots");
  const advance = byId("advance");
  const choiceList = byId("choices");
  const portrait = byId("portrait");
  const artwork = new Map();

  let play = null;
  let line = "";
  let animationFrame = 0;
  let typing = false;
  let slotMode;
  let toastTimer;
  let fallbackStorage = null;

  function endingId(route, kind) {
    return `${route}-${kind}`;
  }

  function bgPath(bg) {
    return `assets/bg/${bg}.png`;
  }

  function portraitPath(route, expression) {
    return `assets/characters/${route}_${expression}.png`;
  }

  function preload(path) {
    if (!artwork.has(path)) {
      const image = new Image();
      image.src = path;
      artwork.set(path, image);
    }
  }

  function normalizeSlot(slot) {
    if (!slot || !Object.hasOwn(routes, slot.route) || !Number.isInteger(slot.scene)) return null;
    const scene = routes[slot.route][slot.scene];
    const date = new Date(slot.savedAt);
    if (!scene || !Number.isInteger(slot.affection) || slot.affection < 0 || slot.affection > 100 ||
        !Number.isFinite(slot.savedAt) || Number.isNaN(date.getTime())) return null;

    const expression = Object.hasOwn(expressions, slot.expression) ? slot.expression : "normal";
    let phase = ["intro", "question", "choices", "reaction"].includes(slot.phase) ? slot.phase : "intro";
    let choice = Number.isInteger(slot.choice) && scene.choices[slot.choice] ? slot.choice : null;

    // Earlier saves recorded a face but did not store the active dialogue.
    if (slot.phase === undefined && expression !== "normal") {
      choice = scene.choices.findIndex(option => option[2] === expression);
      phase = "reaction";
    }
    if (phase === "reaction" && !scene.choices[choice]) phase = "intro";

    return {
      route: slot.route,
      scene: slot.scene,
      affection: slot.affection,
      expression,
      bg: Object.hasOwn(locations, slot.bg) ? slot.bg : scene.bg,
      phase,
      choice,
      savedAt: slot.savedAt
    };
  }

  function readStorage() {
    let stored = fallbackStorage;
    if (!stored) {
      try {
        stored = JSON.parse(localStorage.getItem(storageKey));
      } catch {
        stored = null;
      }
    }
    return {
      slots: Array.from({ length: slotCount }, (_, index) => normalizeSlot(stored?.slots?.[index])),
      endings: endingIds.filter(id => Array.isArray(stored?.endings) && stored.endings.includes(id))
    };
  }

  function writeStorage(stored) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(stored));
      fallbackStorage = null;
      return true;
    } catch {
      fallbackStorage = stored;
      return false;
    }
  }

  function announce(message) {
    byId("toast").textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { byId("toast").textContent = ""; }, 3500);
  }

  function show(screen) {
    if (screen !== "play") cancelAnimationFrame(animationFrame);
    if (screen === "routes") renderRoutes();
    if (screen === "gallery") renderGallery();

    document.body.classList.toggle("playing", screen === "play");
    for (const section of screens) section.hidden = section.id !== screen;
    window.scrollTo(0, 0);
    const active = byId(screen);
    byId(active.getAttribute("aria-labelledby")).focus({ preventScroll: true });
  }

  function renderRoutes() {
    const completed = readStorage().endings;
    byId("route-cards").innerHTML = Object.entries(characters).map(([route, character]) => {
      const badges = Object.entries(endings)
        .filter(([kind]) => completed.includes(endingId(route, kind)))
        .map(([, ending]) => `<span class="badge">${ending.label}</span>`)
        .join("");
      return `<article class="route-card">
        <div class="route-art" style="--character-color: ${character.color}55">
          <img src="${portraitPath(route, "normal")}" alt="">
        </div>
        <div class="route-copy">
          <p class="rank">${character.title}</p>
          <h3>${character.name}</h3>
          <p>${character.profile}</p>
          <p class="fact">${character.fact}</p>
          ${badges ? `<div class="badges" aria-label="クリア済みエンディング">${badges}</div>` : ""}
          <button data-route="${route}">${character.name}を選ぶ</button>
        </div>
      </article>`;
    }).join("");
  }

  function currentScene() {
    return routes[play.route][play.scene];
  }

  function start(route) {
    play = { route, scene: 0, affection: 30, bg: routes[route][0].bg, expression: "normal", phase: "intro", choice: null };
    for (const expression of Object.keys(expressions)) preload(portraitPath(route, expression));
    for (const bg of Object.keys(locations)) preload(bgPath(bg));
    renderScene();
    show("play");
  }

  function updateAffection() {
    const value = `${play.affection}%`;
    byId("score").value = value;
    byId("affection").value = play.affection;
    byId("affection").textContent = value;
  }

  function setPortrait(animate) {
    const path = portraitPath(play.route, play.expression);
    portrait.src = path;
    portrait.alt = `${characters[play.route].name}・${expressions[play.expression]}`;
    portrait.classList.remove("changing");
    if (animate && !reduceMotion.matches) {
      // Restart the animation even when two successive expressions match.
      void portrait.offsetWidth;
      portrait.classList.add("changing");
    }
  }

  function renderScene(restore = false) {
    const scene = currentScene();
    byId("stage").style.setProperty("--scene-art", `url("${bgPath(play.bg)}")`);
    byId("chapter").textContent = scene.chapter;
    byId("progress").textContent = `${play.scene + 1} / ${routes[play.route].length}`;
    updateAffection();
    setPortrait(!restore);
    const order = optionsOrder[(play.scene + Object.keys(routes).indexOf(play.route) * 2) % optionsOrder.length];
    choiceList.replaceChildren(...order.map((index, position) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.dataset.choice = index;
      const letter = document.createElement("span");
      letter.className = "choice-letter";
      letter.setAttribute("aria-hidden", "true");
      letter.textContent = "ABCD"[position];
      button.append(letter, document.createTextNode(scene.choices[index][0]));
      return button;
    }));
    renderDialogue(restore);
  }

  function renderDialogue(immediate = false) {
    const scene = currentScene();
    const text = byId("dialogue-text");
    const intro = play.phase === "intro";
    const choosing = play.phase === "choices";
    line = intro ? scene.intro : play.phase === "reaction" ? scene.choices[play.choice][3] : scene.line;
    byId("speaker").textContent = intro ? "情景" : characters[play.route].name;
    choiceList.hidden = !choosing;
    advance.setAttribute("aria-disabled", String(choosing));
    advance.tabIndex = choosing ? -1 : 0;
    byId("advance-icon").hidden = choosing;
    cancelAnimationFrame(animationFrame);

    if (immediate || choosing || reduceMotion.matches) {
      reveal();
      return;
    }

    text.textContent = "";
    advance.setAttribute("aria-label", "台詞を全文表示");
    typing = true;
    const started = performance.now();
    function tick(now) {
      const count = 1 + Math.floor((now - started) / 22);
      if (count >= line.length) {
        reveal();
        return;
      }
      text.textContent = line.slice(0, count);
      animationFrame = requestAnimationFrame(tick);
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function reveal() {
    cancelAnimationFrame(animationFrame);
    typing = false;
    byId("dialogue-text").textContent = line;
    if (play.phase === "choices") advance.removeAttribute("aria-label");
    else advance.setAttribute("aria-label", `${line}　次へ`);
  }

  function step() {
    if (typing) {
      reveal();
      return;
    }

    if (play.phase === "intro") {
      play.phase = "question";
    } else if (play.phase === "question") {
      play.phase = "choices";
      renderDialogue(true);
      choiceList.firstElementChild.focus({ preventScroll: true });
      return;
    } else if (play.phase === "reaction") {
      if (play.scene === routes[play.route].length - 1) {
        finish();
        return;
      }
      play.scene += 1;
      play.bg = currentScene().bg;
      play.expression = "normal";
      play.phase = "intro";
      play.choice = null;
      renderScene();
      return;
    } else {
      return;
    }
    renderDialogue();
  }

  function choose(index) {
    if (play?.phase !== "choices") return;
    const [, change, expression] = currentScene().choices[index];
    play.affection = Math.max(0, Math.min(100, play.affection + change));
    play.choice = index;
    play.expression = expression;
    play.phase = "reaction";
    updateAffection();
    setPortrait(true);
    renderDialogue();
    advance.focus({ preventScroll: true });
  }

  function finish() {
    const kind = play.affection >= 80 ? "happy" : play.affection >= 40 ? "normal" : "bad";
    const result = characters[play.route].endings[kind];
    const stored = readStorage();
    const id = endingId(play.route, kind);
    if (!stored.endings.includes(id)) {
      stored.endings.push(id);
      if (!writeStorage(stored)) announce("エンディング達成を一時記録しました。ブラウザを閉じると消えます。");
    }
    byId("ending").style.setProperty("--ending-art", `url("${bgPath(play.bg)}")`);
    byId("ending-kind").textContent = `${endings[kind].label}　｜　最終好感度 ${play.affection}%`;
    byId("ending-heading").textContent = result.name;
    byId("ending-summary").textContent = result.summary;
    show("ending");
  }

  function renderGallery() {
    const completed = readStorage().endings;
    byId("gallery-count").textContent = `達成率 ${completed.length} / ${endingIds.length}`;
    byId("gallery-list").innerHTML = Object.entries(characters).flatMap(([route, character]) =>
      Object.entries(endings).map(([kind, ending]) => {
        const open = completed.includes(endingId(route, kind));
        const result = character.endings[kind];
        return `<article class="gallery-card${open ? "" : " locked"}">
          <p>${character.name}　｜　${open ? ending.label : "未到達"}</p>
          <h3>${open ? result.name : "？？？？"}</h3>
          ${open ? `<span class="condition">${ending.condition}</span><p>${result.summary}</p>` : ""}
        </article>`;
      })
    ).join("");
  }

  function renderSlots() {
    const stored = readStorage();
    byId("slot-list").innerHTML = stored.slots.map((slot, index) => {
      const info = slot
        ? `${characters[slot.route].name}　｜　第${slot.scene + 1}話　｜　好感度 ${slot.affection}%<br>
           ${locations[slot.bg]}　｜　表情 ${expressions[slot.expression]}<br>
           ${dateFormat.format(new Date(slot.savedAt))}`
        : "空きスロット";
      const action = slotMode === "save" ? slot ? "上書き" : "保存" : "読み込む";
      return `<div class="slot-row">
        <div class="slot-info"><strong>スロット ${index + 1}</strong>${info}</div>
        <button data-slot="${index}" aria-label="スロット ${index + 1}を${action}" ${slotMode === "load" && !slot ? "disabled" : ""}>${action}</button>
      </div>`;
    }).join("");
  }

  function openSlots(mode) {
    slotMode = mode;
    byId("slots-heading").textContent = mode === "save" ? "セーブ" : "ロード";
    byId("slot-status").textContent = "";
    renderSlots();
    dialog.showModal();
  }

  function useSlot(index) {
    const stored = readStorage();
    if (slotMode === "save") {
      stored.slots[index] = { ...play, savedAt: Date.now() };
      const persisted = writeStorage(stored);
      renderSlots();
      byId("slot-list").querySelector(`[data-slot="${index}"]`).focus();
      byId("slot-status").textContent = persisted
        ? `スロット ${index + 1} に保存しました。`
        : "一時保存しました。ブラウザを閉じると消えます。";
    } else if (stored.slots[index]) {
      play = stored.slots[index];
      dialog.close();
      renderScene(true);
      show("play");
      announce(`スロット ${index + 1} を読み込みました。`);
    }
  }

  advance.addEventListener("click", step);

  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const { screen, route, slots, slot, choice } = button.dataset;
    if (screen) show(screen);
    if (route) start(route);
    if (slots) openSlots(slots);
    if (slot !== undefined) useSlot(Number(slot));
    if (choice !== undefined) choose(Number(choice));
  });

  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
})();
