const token = new URLSearchParams(location.search).get('token');
const state = { step: 1, targetRoot: '', profileRoot: '', runtimes: ['claude', 'codex'], preview: null, result: null };
const customizeState = { config: null, entries: 0, draft: null, preview: null, result: null };

document.querySelectorAll('[data-next]').forEach((button) => button.addEventListener('click', () => showStep(state.step + 1)));
document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => showStep(state.step - 1)));
document.querySelector('#scan-button').addEventListener('click', scan);
document.querySelector('#preview-button').addEventListener('click', preview);
document.querySelector('#apply-button').addEventListener('click', apply);
document.querySelector('#doctor-button').addEventListener('click', doctor);
document.querySelector('#rollback-button').addEventListener('click', rollback);
document.querySelector('#inventory-button').addEventListener('click', inventory);
document.querySelector('#pick-target-root').addEventListener('click', () => pickInto('target-root', 'mac-account'));
document.querySelector('#pick-profile-root').addEventListener('click', () => pickInto('profile-root', 'existing-setup'));
document.querySelector('#pick-capture-output').addEventListener('click', pickCaptureOutput);
document.querySelectorAll('input[name="profile-mode"]').forEach((input) => input.addEventListener('change', switchProfileMode));
document.querySelector('#profile-name').addEventListener('input', syncProfileId);
document.querySelector('#add-custom-entry').addEventListener('click', () => addCustomEntry());
document.querySelector('#customize-preview-button').addEventListener('click', previewCustomizationDraft);
document.querySelector('#customize-back-button').addEventListener('click', () => showCustomizeStep(1));
document.querySelector('#customize-apply-button').addEventListener('click', applyCustomizationDraft);

boot();

async function boot() {
  try {
    const config = await api('/api/config', undefined, 'GET');
    if (config.mode === 'customize') startCustomizer(config);
  } catch {
    // Setup remains usable if an older server does not expose mode configuration.
  }
}

function startCustomizer(config) {
  customizeState.config = config;
  document.querySelector('#setup-progress').hidden = true;
  document.querySelector('#setup-content').hidden = true;
  document.querySelector('#customize-progress').hidden = false;
  document.querySelector('#customize-content').hidden = false;

  const profile = config.profile;
  document.querySelector('#customize-profile-name').value = `${profile.name} — customized`;
  document.querySelector('#customize-profile-id').value = `${profile.id}-custom`;
  document.querySelector('#customize-output').value = config.outRoot;
  renderDefinitionList(document.querySelector('#customize-source-meta'), [
    ['Source profile', `${profile.id}@${profile.version}`],
    ['Source directory', config.profileRoot],
    ['Safety', 'A new profile will be created; the source stays unchanged'],
  ]);
  renderCustomModules(profile.modules);
  addCustomEntry();
  showCustomizeStep(1);
}

function showCustomizeStep(step) {
  for (const [index, id] of ['customize-compose', 'customize-review', 'customize-finish'].entries()) {
    document.querySelector(`#${id}`).hidden = index + 1 !== step;
  }
  document.querySelectorAll('[data-custom-step]').forEach((item) => {
    const itemStep = Number(item.dataset.customStep);
    if (itemStep === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
    item.classList.toggle('is-complete', itemStep < step);
  });
  document.querySelector(`#${['customize-compose', 'customize-review', 'customize-finish'][step - 1]} h1`)?.focus?.();
}

function renderCustomModules(modules) {
  const container = document.querySelector('#customize-modules');
  container.replaceChildren();
  for (const module of modules) {
    const label = document.createElement('label'); label.className = 'module-row';
    const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'retained-module'; input.value = module.id; input.checked = true;
    input.disabled = module.required === true;
    const copy = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = module.id;
    const detail = document.createElement('small');
    detail.textContent = `${humanKind(module.kind)} · ${module.sensitivity}${module.required ? ' · required for continuity' : ''}`;
    copy.append(title, detail); label.append(input, copy); container.append(label);
  }
}

function addCustomEntry(seed = {}) {
  customizeState.entries += 1;
  const entry = document.createElement('fieldset'); entry.className = 'custom-entry'; entry.dataset.customEntry = String(customizeState.entries);
  const legend = document.createElement('legend'); legend.textContent = `New entry ${customizeState.entries}`;

  const kindLabel = document.createElement('label');
  const kindTitle = document.createElement('span'); kindTitle.className = 'field-label'; kindTitle.textContent = 'Type';
  const kind = document.createElement('select'); kind.className = 'field'; kind.dataset.customField = 'kind';
  for (const [value, label] of [
    ['personal-context', 'Personal context'],
    ['operating-policy', 'Operating rule'],
    ['project-standard', 'Project standard'],
    ['capability', 'Universal capability'],
  ]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; kind.append(option);
  }
  kind.value = seed.kind ?? 'personal-context'; kindLabel.append(kindTitle, kind);

  const labelField = document.createElement('label');
  const labelTitle = document.createElement('span'); labelTitle.className = 'field-label'; labelTitle.textContent = 'Label';
  const labelInput = document.createElement('input'); labelInput.className = 'field'; labelInput.dataset.customField = 'label'; labelInput.placeholder = 'How I like feedback'; labelInput.value = seed.label ?? '';
  labelField.append(labelTitle, labelInput);

  const idField = document.createElement('label');
  const idTitle = document.createElement('span'); idTitle.className = 'field-label'; idTitle.textContent = 'Entry id';
  const idInput = document.createElement('input'); idInput.className = 'field'; idInput.dataset.customField = 'id'; idInput.placeholder = 'feedback-preferences'; idInput.value = seed.id ?? '';
  idField.append(idTitle, idInput);
  labelInput.addEventListener('input', () => {
    if (!idInput.dataset.edited) idInput.value = slug(labelInput.value);
  });
  idInput.addEventListener('input', () => { idInput.dataset.edited = 'true'; });

  const contentLabel = document.createElement('label'); contentLabel.className = 'custom-entry-content';
  const contentTitle = document.createElement('span'); contentTitle.className = 'field-label'; contentTitle.textContent = 'What should an agent know or do?';
  const content = document.createElement('textarea'); content.className = 'field'; content.rows = 6; content.dataset.customField = 'content'; content.value = seed.content ?? '';
  contentLabel.append(contentTitle, content);

  const privacy = document.createElement('p'); privacy.className = 'candidate-reason';
  const syncPrivacy = () => {
    privacy.textContent = kind.value === 'personal-context'
      ? 'This entry is marked personal and receives its own consent check when the profile is exported or installed.'
      : kind.value === 'capability'
        ? 'Saddle creates one neutral CAPABILITY.md and generates runtime projections from it.'
        : 'This standard entry is included in the derived profile after preview.';
  };
  kind.addEventListener('change', syncPrivacy); syncPrivacy();

  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-ghost danger custom-entry-remove'; remove.textContent = 'Remove entry';
  remove.addEventListener('click', () => entry.remove());
  entry.append(legend, kindLabel, labelField, idField, contentLabel, privacy, remove);
  document.querySelector('#customize-entries').append(entry);
}

function collectCustomizationDraft() {
  const retainModuleIds = [...document.querySelectorAll('input[name="retained-module"]')]
    .filter((input) => input.checked)
    .map((input) => input.value);
  const entries = [...document.querySelectorAll('[data-custom-entry]')].map((entry) => ({
    kind: entry.querySelector('[data-custom-field="kind"]').value,
    label: entry.querySelector('[data-custom-field="label"]').value.trim(),
    id: entry.querySelector('[data-custom-field="id"]').value.trim(),
    content: entry.querySelector('[data-custom-field="content"]').value.trim(),
  })).filter((entry) => entry.label || entry.id || entry.content);
  return {
    profile: {
      name: document.querySelector('#customize-profile-name').value.trim(),
      id: document.querySelector('#customize-profile-id').value.trim(),
    },
    retainModuleIds,
    entries,
  };
}

async function previewCustomizationDraft() {
  const error = document.querySelector('#customize-compose-error'); error.replaceChildren();
  const button = document.querySelector('#customize-preview-button'); button.disabled = true; button.textContent = 'Building preview…';
  try {
    customizeState.draft = collectCustomizationDraft();
    customizeState.preview = await api('/api/customize/preview', {
      profileRoot: customizeState.config.profileRoot,
      outRoot: document.querySelector('#customize-output').value.trim(),
      draft: customizeState.draft,
    });
    document.querySelector('#customize-preview-state').replaceChildren(renderCustomizationPreview(customizeState.preview));
    showCustomizeStep(2);
  } catch (failure) {
    renderError(error, failure.message);
  } finally {
    button.disabled = false; button.textContent = 'Review new profile';
  }
}

async function applyCustomizationDraft() {
  const button = document.querySelector('#customize-apply-button'); button.disabled = true; button.textContent = 'Creating…';
  try {
    customizeState.result = await api('/api/customize/apply', {
      profileRoot: customizeState.config.profileRoot,
      outRoot: document.querySelector('#customize-output').value.trim(),
      draft: customizeState.draft,
      previewDigest: customizeState.preview.digest,
    });
    renderDefinitionList(document.querySelector('#customize-finish-details'), [
      ['New profile', `${customizeState.result.profile.id}@${customizeState.result.profile.version}`],
      ['Saved to', customizeState.result.outputRoot],
      ['Source profile', customizeState.config.profileRoot],
    ]);
    showCustomizeStep(3);
  } catch (failure) {
    renderError(document.querySelector('#customize-preview-state'), failure.message);
  } finally {
    button.disabled = false; button.textContent = 'Create this profile';
  }
}

function renderCustomizationPreview(preview) {
  const wrapper = document.createElement('div');
  const plan = preview.plan;
  const metadata = document.createElement('dl'); metadata.className = 'preview-meta';
  renderDefinitionList(metadata, [
    ['Source', `${plan.sourceProfile.id}@${plan.sourceProfile.version}`],
    ['New profile', `${plan.derivedProfile.id}@${plan.derivedProfile.version}`],
    ['Save to', plan.outputRoot],
    ['Preview digest', preview.digest],
  ]);
  wrapper.append(metadata);
  for (const [title, modules, empty] of [
    ['Kept', plan.retainedModules, 'No existing modules kept.'],
    ['Removed', plan.removedModules, 'No modules removed.'],
    ['Added', plan.addedModules, 'No new entries added.'],
  ]) {
    const section = document.createElement('section'); section.className = 'customize-review-group';
    const heading = document.createElement('h2'); heading.textContent = title; section.append(heading);
    if (!modules.length) { const note = document.createElement('p'); note.textContent = empty; section.append(note); }
    for (const module of modules) section.append(row('•', module.label ?? module.id, `${humanKind(module.kind)} · ${module.sensitivity}`));
    wrapper.append(section);
  }
  if (plan.requiredConsents?.length) {
    const note = document.createElement('aside'); note.className = 'notice';
    const lead = document.createElement('strong'); lead.textContent = 'Personal consent remains granular.';
    note.append(lead, document.createTextNode(` ${plan.requiredConsents.length} personal ${plan.requiredConsents.length === 1 ? 'entry requires' : 'entries require'} separate confirmation when this profile is exported or installed.`));
    wrapper.append(note);
  }
  const operations = document.createElement('section'); operations.className = 'customize-review-group';
  const heading = document.createElement('h2'); heading.textContent = 'Files to create'; operations.append(heading);
  for (const operation of plan.operations ?? []) operations.append(renderCustomizationOperation(operation));
  wrapper.append(operations);
  return wrapper;
}

function renderCustomizationOperation(item) {
  const operation = document.createElement('div'); operation.className = 'operation';
  const action = document.createElement('strong'); action.textContent = `${item.action.replaceAll('-', ' ')} · ${item.risk ?? 'low'}`;
  if (item.risk === 'personal' || item.risk === 'restricted' || item.risk === 'high') action.className = 'risk-high';
  const copy = document.createElement('div');
  const target = document.createElement('code'); target.textContent = item.target;
  const reason = document.createElement('small'); reason.textContent = item.reason;
  const digest = document.createElement('small'); digest.className = 'operation-modules'; digest.textContent = `Digest: ${item.digest} · Risk: ${item.risk ?? 'low'}`;
  const details = document.createElement('details'); details.className = 'content-preview';
  const summary = document.createElement('summary'); summary.textContent = item.contentEncoding === 'base64' ? 'Review exact proposed bytes (base64)' : 'Review proposed content';
  const pre = document.createElement('pre'); pre.textContent = item.content;
  details.append(summary, pre);
  copy.append(target, document.createElement('br'), reason, document.createElement('br'), digest, details);
  operation.append(action, copy);
  return operation;
}

function renderDefinitionList(container, pairs) {
  container.replaceChildren();
  for (const [label, value] of pairs) {
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    container.append(term, detail);
  }
}

function humanKind(kind) {
  return ({
    'personal-context': 'personal context',
    'operating-policy': 'operating rule',
    'project-standard': 'project standard',
    capability: 'universal capability',
    'session-continuity': 'session continuity',
  })[kind] ?? kind;
}

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
  if (!targetRoot) return renderError(container, 'Choose this Mac account folder or enter its full path.');
  container.innerHTML = '<p class="loading">Checking Claude and Codex folders…</p>';
  try {
    const data = await api('/api/scan', { targetRoot, runtimes: selectedRuntimes() });
    state.targetRoot = data.targetRoot;
    container.replaceChildren(...data.results.map((result) => row(
      result.detected ? '●' : '○',
      result.id === 'claude' ? 'Claude' : 'Codex',
      result.detected ? 'Saddle found this assistant’s folder' : 'No folder found yet — Saddle can create its managed files here',
    )));
    if (!data.results.some((result) => result.detected)) {
      const existingMode = document.querySelector('input[name="profile-mode"][value="existing"]');
      existingMode.checked = true;
      switchProfileMode();
      const guidance = document.createElement('p');
      guidance.className = 'notice';
      guidance.textContent = 'No existing setup was found. Next, choose the Saddle setup you brought from another computer.';
      container.append(guidance);
    }
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
    if (!state.profileRoot || !state.targetRoot) throw new Error('Choose the Saddle setup folder and the Mac account you want to set up.');
    showStep(4);
    container.innerHTML = '<p class="loading">Checking your instructions and current files…</p>';
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
  container.innerHTML = '<p class="loading">Finding instructions on this Mac…</p>';
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
  if (!outputRoot || !name || !id) throw new Error('Name this setup and choose where to save it.');
  if (!selections.length) throw new Error('Choose at least one instruction to save.');
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
  document.querySelector('#preview-button').textContent = capture ? 'Save these instructions and review changes' : 'Review files before installing';
}

function syncProfileId() {
  document.querySelector('#profile-id').value = slug(document.querySelector('#profile-name').value) || 'my-setup';
}

async function pickInto(fieldId, purpose) {
  const field = document.querySelector(`#${fieldId}`);
  const errorContainer = document.querySelector(`#${fieldId}-error`);
  errorContainer.replaceChildren();
  try {
    const result = await api('/api/pick-directory', { purpose, defaultPath: field.value.trim() || '/Users' });
    field.value = result.path;
  } catch (error) {
    renderError(errorContainer, error.message);
  }
}

async function pickCaptureOutput() {
  const field = document.querySelector('#capture-output');
  const errorContainer = document.querySelector('#capture-output-error');
  errorContainer.replaceChildren();
  try {
    const result = await api('/api/pick-directory', { purpose: 'new-setup', defaultPath: parentDirectory(field.value.trim()) || '/Users' });
    field.value = `${result.path.replace(/\/$/, '')}/${document.querySelector('#profile-id').value}`;
  } catch (error) {
    renderError(errorContainer, error.message);
  }
}

function parentDirectory(value) {
  const slash = value.lastIndexOf('/');
  return slash > 0 ? value.slice(0, slash) : '';
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

  wrapper.append(renderCandidateSection('Suggested instructions', 'General instructions are selected to start.', foundation, { checked: true }));
  wrapper.append(renderCapabilities(capabilities));
  wrapper.append(renderCandidateSection('Personal details', 'Personal details stay optional and need your approval before Saddle installs them.', personal));

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
  const heading = document.createElement('h2'); heading.textContent = 'Optional tools';
  const explanation = document.createElement('p'); explanation.className = 'candidate-section-copy'; explanation.textContent = 'No tool is required. Choose only workflows you use; Saddle can make them available to each assistant you selected.';
  section.append(heading, explanation);
  if (!entries.length) {
    const empty = document.createElement('p'); empty.className = 'candidate-reason'; empty.textContent = 'No optional tools found.'; section.append(empty);
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
  const detail = document.createElement('span'); detail.className = 'candidate-reason'; detail.textContent = 'Do not bring this tool into the new setup.';
  label.append(input, title, detail);
  return label;
}

function renderNeedsAttention(entries, warnings) {
  const details = document.createElement('details'); details.className = 'candidate-group needs-attention';
  const summary = document.createElement('summary'); summary.textContent = `Needs attention · ${entries.length + warnings.length}`;
  const copy = document.createElement('p'); copy.className = 'candidate-section-copy'; copy.textContent = 'These items are excluded, need extra care, or need review before saving.';
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
  button.textContent = 'Installing…';
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
      document.querySelector('#finish-title').textContent = 'This setup needs attention.';
      document.querySelector('#finish-copy').textContent = 'Saddle changed files but could not finish checking them. Undo this setup before continuing.';
      renderError(document.querySelector('#recovery-state'), state.result.verificationError ?? 'The files changed, but Saddle could not check them. Use Undo this setup below.');
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
  recovery.textContent = 'Checking installed files…';
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
  recovery.textContent = 'Restoring the files from before setup…';
  try {
    await api('/api/rollback', {
      transactionId: state.result.transaction.id,
      targetRoot: state.targetRoot,
      stateRoot: `${state.targetRoot}/.saddle`,
    });
    document.querySelector('#finish-title').textContent = 'This setup was undone.';
    document.querySelector('#finish-copy').textContent = 'Saddle restored the files that were there before this setup.';
    document.querySelector('.first-task').textContent = 'Nothing from this setup remains installed. You can close Saddle or start again.';
    recovery.textContent = 'Files restored and checked.';
    document.querySelector('#doctor-button').disabled = true;
    document.querySelector('#rollback-button').disabled = true;
  } catch (error) {
    renderError(recovery, error.message);
  }
}

function selectedRuntimes() {
  const values = [...document.querySelectorAll('input[name="runtime"]:checked')].map((input) => input.value);
  if (!values.length) throw new Error('Choose Claude, Codex, or both.');
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

async function api(endpoint, body, method = 'POST') {
  const response = await fetch(endpoint, {
    method,
    headers: { 'content-type': 'application/json', 'x-saddle-token': token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
  const assurance = document.createElement('p'); assurance.className = 'candidate-section-copy'; assurance.textContent = 'Saddle will recheck the files before installing them.';
  const technical = document.createElement('details'); technical.className = 'technical-details';
  const technicalSummary = document.createElement('summary'); technicalSummary.textContent = 'Technical details'; technical.append(technicalSummary);
  const metadata = document.createElement('dl'); metadata.className = 'preview-meta';
  for (const [label, value] of [['Setup', `${previewData.plan.profile.id}@${previewData.plan.profile.version}`], ['Check code', previewData.digest], ['Mac account', previewData.plan.targetRoot]]) {
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    metadata.append(term, detail);
  }
  technical.append(metadata);
  if (previewData.requiredConsents?.length) {
    const consent = document.createElement('fieldset'); consent.className = 'consent-list';
    const legend = document.createElement('legend'); legend.textContent = 'Approve personal or sensitive instructions';
    const explanation = document.createElement('p'); explanation.textContent = 'Choose each item you want Saddle to install on this Mac.';
    consent.append(legend, explanation);
    for (const item of previewData.requiredConsents) {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'import-consent'; input.value = item.id;
      const copy = document.createElement('span'); copy.textContent = `Install “${item.id}” (${humanKind(item.kind)})`;
      label.append(input, copy); consent.append(label);
    }
    wrapper.append(consent);
  }
  const operations = document.createElement('div');
  previewData.plan.operations.forEach((item) => {
    const operation = document.createElement('div'); operation.className = 'operation';
    const action = document.createElement('strong'); action.textContent = humanAction(item.action);
    if (item.risk === 'personal' || item.risk === 'restricted' || item.risk === 'high') action.className = 'risk-high';
    const copy = document.createElement('div');
    const target = document.createElement('code'); target.textContent = item.target;
    const explanation = document.createElement('small'); explanation.textContent = humanOperationExplanation(item);
    copy.append(target, document.createElement('br'), explanation);
    const operationTechnical = document.createElement('details'); operationTechnical.className = 'operation-technical';
    const operationTechnicalSummary = document.createElement('summary'); operationTechnicalSummary.textContent = 'Technical details';
    const reason = document.createElement('small'); reason.textContent = item.reason;
    operationTechnical.append(operationTechnicalSummary, reason);
    if (item.sourceModules?.length) {
      const modules = document.createElement('small'); modules.className = 'operation-modules'; modules.textContent = `Modules: ${item.sourceModules.join(', ')} · Risk: ${item.risk}`;
      operationTechnical.append(document.createElement('br'), modules);
    }
    copy.append(operationTechnical);
    if (typeof item.content === 'string') {
      const details = document.createElement('details'); details.className = 'content-preview';
      const summary = document.createElement('summary'); summary.textContent = 'See the file contents';
      const pre = document.createElement('pre'); pre.textContent = item.content;
      details.append(summary, pre); copy.append(details);
    }
    operation.append(action, copy);
    operations.append(operation);
  });
  wrapper.append(assurance, technical, operations);
  return wrapper;
}

function humanAction(action) {
  return ({ 'create-file': 'Add file', 'replace-file': 'Update file', 'delete-file': 'Remove file' })[action] ?? action.replaceAll('-', ' ');
}

function humanOperationExplanation(item) {
  const assistant = item.target.startsWith('.claude/') ? 'Claude' : item.target.startsWith('.codex/') ? 'Codex' : 'the assistant';
  if (item.action === 'delete-file') return 'This removes a Saddle file that is no longer needed.';
  return `This file gives ${assistant} the instructions you selected.`;
}

function renderFinish() {
  const details = document.querySelector('#finish-details');
  details.replaceChildren();
  for (const [label, value] of [
    ['Instructions from', state.profileRoot],
    ['Set up', state.runtimes.map(runtimeName).join(' and ')],
    ['Mac account', state.targetRoot],
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
