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
    document.querySelectorAll('input[name="import-consent"]').forEach((input) => input.addEventListener('change', syncApplyEnabled));
    syncApplyEnabled();
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
    container.replaceChildren(renderInventory(result.inventories));
  } catch (error) {
    renderError(container, error.message);
  }
}

async function captureProfile() {
  const outputRoot = document.querySelector('#capture-output').value.trim();
  const name = document.querySelector('#profile-name').value.trim();
  const id = document.querySelector('#profile-id').value.trim();
  const selections = [...document.querySelectorAll('.candidate-selection:checked')]
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

function renderInventory(inventories) {
  const wrapper = document.createElement('div');
  const entries = inventories.flatMap((inventoryResult) => inventoryResult.candidates.map((candidate) => ({ candidate, runtime: inventoryResult.runtime })));
  const foundation = entries.filter(({ candidate }) => candidate.selectable && candidate.sourceType === 'instruction-section' && candidate.suggestedSensitivity === 'standard');
  const capabilities = entries.filter(({ candidate }) => candidate.sourceType === 'capability' && candidate.selectable);
  const personal = entries.filter(({ candidate }) => candidate.selectable && candidate.suggestedSensitivity === 'personal');
  const attention = entries.filter(({ candidate }) => !candidate.selectable || (candidate.suggestedSensitivity === 'restricted' && candidate.sourceType !== 'capability'));

  wrapper.append(renderCandidateSection('Recommended foundation', 'Portable instruction sections selected by default.', foundation, { checked: true }));
  wrapper.append(renderCapabilities(capabilities));
  wrapper.append(renderCandidateSection('Personalization', 'Personal context stays optional and requires consent before it can be applied.', personal));

  const warnings = inventories.flatMap((inventoryResult) => inventoryResult.warnings.map((warning) => ({ ...warning, runtime: inventoryResult.runtime })));
  wrapper.append(renderNeedsAttention(attention, warnings));
  return wrapper;
}

function renderCandidateSection(title, copy, entries, options = {}) {
  const section = document.createElement('section'); section.className = 'candidate-group';
  const heading = document.createElement('h2'); heading.textContent = title;
  const explanation = document.createElement('p'); explanation.className = 'candidate-section-copy'; explanation.textContent = copy;
  section.append(heading, explanation);
  if (!entries.length) {
    const empty = document.createElement('p'); empty.className = 'candidate-reason'; empty.textContent = 'Nothing found.'; section.append(empty);
  }
  entries.forEach(({ candidate }) => section.append(renderCandidate(candidate, options)));
  return section;
}

function renderCapabilities(entries) {
  const section = document.createElement('section'); section.className = 'candidate-group';
  const heading = document.createElement('h2'); heading.textContent = 'Optional capabilities';
  const explanation = document.createElement('p'); explanation.className = 'candidate-section-copy'; explanation.textContent = 'No capability is required for setup. Choose only portable workflows you use; one universal capability will project to every selected runtime.';
  section.append(heading, explanation);
  if (!entries.length) {
    const empty = document.createElement('p'); empty.className = 'candidate-reason'; empty.textContent = 'No portable capabilities found.'; section.append(empty);
    return section;
  }
  const groups = new Map();
  for (const entry of entries) {
    const id = slug(canonicalCapabilityName(entry.candidate));
    groups.set(id, [...(groups.get(id) ?? []), entry]);
  }
  for (const [id, candidates] of groups) {
    const group = document.createElement('fieldset'); group.className = 'capability-choice';
    const legend = document.createElement('legend'); legend.textContent = id;
    group.append(legend);
    if (candidates.length === 1) {
      group.append(renderCandidate(candidates[0].candidate));
    } else {
      group.append(renderCapabilitySkipChoice(id));
      candidates.forEach(({ candidate }) => group.append(renderCandidate(candidate, {
        type: 'radio', name: `capability-${id}`,
      })));
    }
    section.append(group);
  }
  return section;
}

function renderCapabilitySkipChoice(id) {
  const label = document.createElement('label'); label.className = 'candidate';
  const input = document.createElement('input'); input.type = 'radio'; input.name = `capability-${id}`; input.checked = true;
  const title = document.createElement('span'); title.className = 'candidate-title'; title.textContent = 'Do not include';
  const detail = document.createElement('span'); detail.className = 'candidate-reason'; detail.textContent = 'Keep this universal capability out of the profile.';
  label.append(input, title, detail);
  return label;
}

function renderNeedsAttention(entries, warnings) {
  const details = document.createElement('details'); details.className = 'candidate-group needs-attention';
  const summary = document.createElement('summary'); summary.textContent = `Needs attention · ${entries.length + warnings.length}`;
  const copy = document.createElement('p'); copy.className = 'candidate-section-copy'; copy.textContent = 'These items are excluded, restricted instruction sections, or need review before capture.';
  details.append(summary, copy);
  if (!entries.length && !warnings.length) {
    const empty = document.createElement('p'); empty.className = 'candidate-reason'; empty.textContent = 'Nothing needs review.'; details.append(empty);
  }
  entries.forEach(({ candidate }) => details.append(renderCandidate(candidate)));
  warnings.forEach((warning) => {
    const note = document.createElement('p'); note.className = 'candidate-reason';
    note.textContent = `Skipped ${runtimeName(warning.runtime)} · ${warning.source}: ${warning.reason}`;
    details.append(note);
  });
  return details;
}

function renderCandidate(candidate, { type = 'checkbox', name = 'candidate', checked = false } = {}) {
  const label = document.createElement('label'); label.className = 'candidate';
  const input = document.createElement('input');
  input.type = type; input.name = name; input.value = candidate.id; input.dataset.runtime = candidate.runtime; input.className = 'candidate-selection';
  input.disabled = !candidate.selectable;
  input.checked = checked && candidate.selectable;
  const titleElement = document.createElement('span'); titleElement.className = 'candidate-title';
  titleElement.textContent = candidate.heading ?? (candidate.sourceType === 'capability' ? canonicalCapabilityName(candidate) : 'Introduction');
  const tag = document.createElement('span'); tag.className = `tag tag-${candidate.suggestedSensitivity}`;
  tag.textContent = candidate.selectable ? `${runtimeName(candidate.runtime)} · ${candidate.suggestedKind} · ${candidate.suggestedSensitivity}` : 'excluded';
  const source = document.createElement('span'); source.className = 'candidate-source'; source.textContent = candidate.source;
  const reason = document.createElement('span'); reason.className = 'candidate-reason'; reason.textContent = candidate.reasons.join(' ');
  label.append(input, titleElement, tag, source, reason);
  return label;
}

function canonicalCapabilityName(candidate) {
  return candidate.source.split('/').at(-2) ?? candidate.source;
}

function runtimeName(runtime) {
  return runtime === 'claude' ? 'Claude' : 'Codex';
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
      consents: selectedImportConsents(),
    });
    const exact = !state.result.verificationError && state.result.verification.length === state.runtimes.length && state.result.verification.every((item) => item.verification.status === 'exact');
    renderFinish();
    showStep(5);
    if (!exact) {
      document.querySelector('#finish-title').textContent = 'The apply needs attention.';
      document.querySelector('#finish-copy').textContent = 'Verification did not pass. Roll back this transaction before continuing.';
      renderError(document.querySelector('#recovery-state'), state.result.verificationError ?? 'The files changed, but Saddle could not verify the installed profile. Use Roll back this setup below.');
    }
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

function selectedImportConsents() {
  return [...document.querySelectorAll('input[name="import-consent"]:checked')].map((input) => input.value);
}

function syncApplyEnabled() {
  const required = state.preview?.requiredConsents?.length ?? 0;
  document.querySelector('#apply-button').disabled = selectedImportConsents().length !== required;
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
  if (previewData.requiredConsents?.length) {
    const consent = document.createElement('fieldset'); consent.className = 'consent-list';
    const legend = document.createElement('legend'); legend.textContent = 'Confirm destination use';
    const explanation = document.createElement('p'); explanation.textContent = 'These items are personal or restricted. Confirm each item before Apply.';
    consent.append(legend, explanation);
    for (const item of previewData.requiredConsents) {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'import-consent'; input.value = item.id;
      const copy = document.createElement('span'); copy.textContent = `${item.id} · ${item.kind} · ${item.sensitivity}`;
      label.append(input, copy); consent.append(label);
    }
    wrapper.append(consent);
  }
  const operations = document.createElement('div');
  previewData.plan.operations.forEach((item) => {
    const operation = document.createElement('div'); operation.className = 'operation';
    const action = document.createElement('strong'); action.textContent = item.action.replaceAll('-', ' ');
    if (item.risk === 'personal' || item.risk === 'restricted' || item.risk === 'high') action.className = 'risk-high';
    const copy = document.createElement('div');
    const target = document.createElement('code'); target.textContent = item.target;
    const reason = document.createElement('small'); reason.textContent = item.reason;
    copy.append(target, document.createElement('br'), reason);
    if (item.sourceModules?.length) {
      const modules = document.createElement('small'); modules.className = 'operation-modules'; modules.textContent = `Modules: ${item.sourceModules.join(', ')} · Risk: ${item.risk}`;
      copy.append(document.createElement('br'), modules);
    }
    if (typeof item.content === 'string') {
      const details = document.createElement('details'); details.className = 'content-preview';
      const summary = document.createElement('summary'); summary.textContent = 'Review proposed content';
      const pre = document.createElement('pre'); pre.textContent = item.content;
      details.append(summary, pre); copy.append(details);
    }
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
