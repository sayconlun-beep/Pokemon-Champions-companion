import { escapeText } from './SearchableSelector.js';

const NATURES = [
  ['Adamant','Attack','Sp. Attack'], ['Bashful','',''], ['Bold','Defense','Attack'], ['Brave','Attack','Speed'],
  ['Calm','Sp. Defense','Attack'], ['Careful','Sp. Defense','Sp. Attack'], ['Docile','',''], ['Gentle','Sp. Defense','Defense'],
  ['Hardy','',''], ['Hasty','Speed','Defense'], ['Impish','Defense','Sp. Attack'], ['Jolly','Speed','Sp. Attack'],
  ['Lax','Defense','Sp. Defense'], ['Lonely','Attack','Defense'], ['Mild','Sp. Attack','Defense'], ['Modest','Sp. Attack','Attack'],
  ['Naive','Speed','Sp. Defense'], ['Naughty','Attack','Sp. Defense'], ['Quiet','Sp. Attack','Speed'], ['Quirky','',''],
  ['Rash','Sp. Attack','Sp. Defense'], ['Relaxed','Defense','Speed'], ['Sassy','Sp. Defense','Speed'], ['Serious','',''], ['Timid','Speed','Attack']
];

const BASE_NATURE_OPTIONS = NATURES.map(([name, inc, dec]) => ({
  value: name,
  label: name,
  detail: inc && dec ? `+${inc} / -${dec}` : 'No stat change',
  searchTerms: [inc, dec, inc ? `plus ${inc}` : 'neutral', dec ? `minus ${dec}` : 'neutral']
}));

export function NatureSelect(slotIndex, slot) {
  const selectedNature = slot?.nature || '';
  const selectedOption = BASE_NATURE_OPTIONS.find((option) => option.value === selectedNature);
  const summaryLabel = selectedOption
    ? `${selectedOption.label}${selectedOption.detail === 'No stat change' ? ' (neutral)' : ` (${selectedOption.detail.replace(' / ', ', ')})`}`
    : 'Choose nature';

  const optionButtons = [
    { value: '', label: 'Nature', detail: 'Clear selection' },
    ...BASE_NATURE_OPTIONS
  ].map((option) => {
    const active = selectedNature === option.value;
    const detail = option.detail === 'No stat change' ? 'neutral' : option.detail?.replace(' / ', ', ');
    const label = option.value ? `${option.label}${detail ? ` (${detail})` : ''}` : option.label;
    return `<button type="button" class="compact-nature-option${active ? ' is-selected' : ''}" data-nature-choice-slot="${slotIndex}" data-nature-choice="${escapeText(option.value)}" aria-pressed="${active ? 'true' : 'false'}">
      <span>${escapeText(label)}</span>
      <span class="compact-nature-radio" aria-hidden="true"></span>
    </button>`;
  }).join('');

  return `<details class="native-inline-select native-nature-select compact-nature-select">
    <summary aria-label="Nature selector">
      <span class="native-inline-select-label">Nature</span>
      <span class="native-inline-select-value">${escapeText(summaryLabel)}</span>
    </summary>
    <div class="compact-nature-menu" role="listbox" aria-label="Nature options">
      ${optionButtons}
    </div>
  </details>`;
}
