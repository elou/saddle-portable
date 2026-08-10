const token = new URLSearchParams(location.search).get('token');
const state = { step: 1, targetRoot: '', profileRoot: '', runtimes: ['claude', 'codex'], preview: null, result: null };

document.querySelectorAll('[data-next]').forEach((button) => button.addEventListener('click', () => showStep(state.step + 1)));
document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => showStep(state.step - 1)));
document.querySelector('#scan-button').addEventListener('click', scan);
document.querySelector('#preview-button').addEventListener('click', preview);
document.querySelector('#apply-button').addEventListener('click', apply);
document.querySelector('#doctor-button').addEventListener('click', doctor);
document.querySelector('#rollback-button').addEventListener('click', rollback);
document.querySelector('#inventory-button').addEventListener('click', inventory);
document.querySelectorAll('input[name="profile-mode"]').forEach((input) => input.addEventListener('change', switchProfileMode));

function showStep(step) {
  state.step = Math.max(1, Math.min(5, step));
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    const active = Number(panel.dataset.panel) === state.step;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  document.querySelectorAll('[data-step]').forEach((item) => {
    const itemStep = Number(item.dataset.step);
    if (itemStep === state.step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
    item.classList.toggle('is-complete', itemStep < state.step);
  });
  document.querySelector('#step-label').textContent = `Step ${state.step} of 5`;
  document.querySelector(`[data-panel="${state.step}"] h1`)?.focus?.();
}

async function scan() {
  const targetRoot = document.querySelector('#target-root').value.trim();
  const container = document.querySelector('#scan-state');
  if (!targetRoot) return renderError(container, 'Enter an absolute home directory.');
  container.innerHTML = '<p class="loading">Scanning supported runtime folders…</p>';
  try {
    const data = await api('/api/scan', { targetRoot, runtimes: selectedRuntimes() });
    state.targetRoot = data.targetRoot;
    container.replaceChildren(...data.results.map((result) => row(
      result.detected ? '●' : '○',
      result.id === 'claude' ? 'Claude' : 'Codex',
      result.detected ? 'Runtime folder detected' : 'No runtime folder yet — Saddle can create managed files',
    )));
    document.querySelector('#runtime-next').disabled = false;
  } catch (error) {
    renderError(container, error.message);
  }
}

async function preview() {
  const container = document.querySelector('#preview-state');
  try {
    state.runtimes = selectedRuntimes();
    if (profileMode() === 'capture') await captureProfile();
    else state.profileRoot = document.querySelector('#profile-root').value.trim();
    if (!state.profileRoot || !state.targetRoot) throw new Error('Profile and target paths are required.');
    showStep(4);
    container.innerHTML = '<p class="loading">Reading the profile and current target state…</p>';
    document.querySelector('#apply-button').disabled = true;
    state.preview = await api('/api/plan', requestBody());
    container.replaceChildren(renderPreview(state.preview));
    document.querySelector('#apply-button').disabled = false;
  } catch (error) {
    renderError(container, error.message);
  }
}

async function inventory() {
  const container = document.querySelector('#inventory-state');
  container.innerHTML = '<p class="loading">Reading authored sections and capability entrypoints…</p>';
  try {
    state.runtimes = selectedRuntimes();
    const result = await api('/api/inventory', { targetRoot: state.targetRoot, runtimes: state.runtimes });
    container.replaceChildren(...result.inventories.map(renderInventoryGroup));
  } catch (error) {
    renderError(container, error.message);
  }
}

async function captureProfile() {
  const outputRoot = document.querySelector('#capture-output').value.trim();
  const name = document.querySelector('#profile-name').value.trim();
  const id = document.querySelector('#profile-id').value.trim();
  const selections = [...document.querySelectorAll('input[name="candidate"]:checked')]
    .map((input) => ({ runtime: input.dataset.runtime, id: input.value }));
  if (!outputRoot || !name || !id) throw new Error('Profile name, id, and save location are required.');
  if (!selections.length) throw new Error('Select at least one authored item to capture.');
  await api('/api/capture', {
    targetRoot: state.targetRoot,
    outputRoot,
    profile: { id, name },
    selections,
  });
  state.profileRoot = outputRoot;
}

function switchProfileMode() {
  const capture = profileMode() === 'capture';
  document.querySelector('#capture-mode').hidden = !capture;
  document.querySelector('#existing-mode').hidden = capture;
  document.querySelector('#preview-button').textContent = capture ? 'Create profile and preview' : 'Build preview';
}

function profileMode() {
  return document.querySelector('input[name="profile-mode"]:checked').value;
}

function renderInventoryGroup(inventoryResult) {
  const group = document.createElement('section'); group.className = 'candidate-group';
  const heading = document.createElement('h2');
  heading.textContent = `${inventoryResult.runtime === 'claude' ? 'Claude' : 'Codex'} · ${inventoryResult.candidates.length} candidates`;
  group.append(heading);
  if (!inventoryResult.candidates.length) {
    const empty = document.createElement('p'); empty.className = 'candidate-reason'; empty.textContent = 'No authored guidance found.'; group.append(empty);
  }
  inventoryResult.candidates.forEach((candidate) => group.append(renderCandidate(candidate)));
  inventoryResult.warnings.forEach((warning) => {
    const note = document.createElement('p'); note.className = 'candidate-reason'; note.textContent = `Skipped ${warning.source}: ${warning.reason}`; group.append(note);
  });
  return group;
}

function renderCandidate(candidate) {
  const label = document.createElement('label'); label.className = 'candidate';
  const input = document.createElement('input');
  input.type = 'checkbox'; input.name = 'candidate'; input.value = candidate.id; input.dataset.runtime = candidate.runtime;
  input.disabled = !candidate.selectable;
  input.checked = candidate.selectable && candidate.suggestedSensitivity === 'standard' && candidate.sourceType === 'instruction-section';
  const titleElement = document.createElement('span'); titleElement.className = 'candidate-title';
  titleElement.textContent = candidate.heading ?? (candidate.sourceType === 'capability' ? candidate.source.split('/').at(-2) : 'Introduction');
  const tag = document.createElement('span'); tag.className = `tag tag-${candidate.suggestedSensitivity}`;
  tag.textContent = candidate.selectable ? `${candidate.suggestedKind} · ${candidate.suggestedSensitivity}` : 'excluded';
  const source = document.createElement('span'); source.className = 'candidate-source'; source.textContent = candidate.source;
  const reason = document.createElement('span'); reason.className = 'candidate-reason'; reason.textContent = candidate.reasons.join(' ');
  label.append(input, titleElement, tag, source, reason);
  return label;
}

async function apply() {
  const button = document.querySelector('#apply-button');
  button.disabled = true;
  button.textContent = 'Applying…';
  try {
    state.result = await api('/api/apply', {
      ...requestBody(),
      stateRoot: `${state.targetRoot}/.saddle`,
      planDigest: state.preview.digest,
    });
    const exact = state.result.verification.every((item) => item.verification.status === 'exact');
    if (!exact) throw new Error('Files were applied, but verification did not pass. Use rollback before continuing.');
    renderFinish();
    showStep(5);
  } catch (error) {
    renderError(document.querySelector('#preview-state'), error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Apply this preview';
  }
}

async function doctor() {
  const recovery = document.querySelector('#recovery-state');
  recovery.hidden = false;
  recovery.textContent = 'Checking managed files and lifecycle support…';
  try {
    const result = await api('/api/doctor', requestBody());
    recovery.textContent = result.results.map((item) => `${item.runtime}: ${item.verification.status}`).join(' · ');
  } catch (error) {
    renderError(recovery, error.message);
  }
}

async function rollback() {
  if (!state.result?.transaction?.id) return;
  const recovery = document.querySelector('#recovery-state');
  recovery.hidden = false;
  recovery.textContent = 'Restoring the previous files…';
  try {
    await api('/api/rollback', {
      transactionId: state.result.transaction.id,
      targetRoot: state.targetRoot,
      stateRoot: `${state.targetRoot}/.saddle`,
    });
    document.querySelector('#finish-title').textContent = 'The profile was rolled back.';
    document.querySelector('#finish-copy').textContent = 'Saddle restored the files that existed before this setup transaction.';
    recovery.textContent = 'Rollback verified.';
    document.querySelector('#rollback-button').disabled = true;
  } catch (error) {
    renderError(recovery, error.message);
  }
}

function selectedRuntimes() {
  const values = [...document.querySelectorAll('input[name="runtime"]:checked')].map((input) => input.value);
  if (!values.length) throw new Error('Select at least one runtime.');
  return values;
}

function requestBody() {
  return { profileRoot: state.profileRoot, targetRoot: state.targetRoot, runtimes: state.runtimes };
}

async function api(endpoint, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-saddle-token': token },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Saddle could not complete the request.');
  return data;
}

function row(symbol, title, detail) {
  const element = document.createElement('div');
  element.className = 'result-row';
  const icon = document.createElement('span'); icon.className = 'result-symbol'; icon.textContent = symbol;
  const name = document.createElement('strong'); name.textContent = title;
  const metadata = document.createElement('small'); metadata.textContent = detail;
  element.append(icon, name, metadata);
  return element;
}

function renderPreview(previewData) {
  const wrapper = document.createElement('div');
  const metadata = document.createElement('dl'); metadata.className = 'preview-meta';
  for (const [label, value] of [['Profile', `${previewData.plan.profile.id}@${previewData.plan.profile.version}`], ['Plan digest', previewData.digest], ['Target', previewData.plan.targetRoot]]) {
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    metadata.append(term, detail);
  }
  const operations = document.createElement('div');
  previewData.plan.operations.forEach((item) => {
    const operation = document.createElement('div'); operation.className = 'operation';
    const action = document.createElement('strong'); action.textContent = item.action.replaceAll('-', ' ');
    if (item.risk === 'restricted' || item.risk === 'high') action.className = 'risk-high';
    const copy = document.createElement('div');
    const target = document.createElement('code'); target.textContent = item.target;
    const reason = document.createElement('small'); reason.textContent = item.reason;
    copy.append(target, document.createElement('br'), reason);
    operation.append(action, copy);
    operations.append(operation);
  });
  wrapper.append(metadata, operations);
  return wrapper;
}

function renderFinish() {
  const details = document.querySelector('#finish-details');
  details.replaceChildren();
  for (const [label, value] of [
    ['Transaction', state.result.transaction.id],
    ['Profile source', state.profileRoot],
    ['Installed to', state.targetRoot],
  ]) {
    const rowElement = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    rowElement.append(term, detail); details.append(rowElement);
  }
}

function renderError(container, message) {
  container.hidden = false;
  container.innerHTML = '';
  const notice = document.createElement('p'); notice.className = 'notice error'; notice.textContent = message;
  container.append(notice);
}
