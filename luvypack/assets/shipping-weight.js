(() => {
  'use strict';
  const form = document.getElementById('weight-form');
  if (!form) return;
  const byId = id => document.getElementById(id);
  const result = byId('result');
  const ids = ['weight-length', 'weight-width', 'weight-height', 'weight-divisor'];
  const presentPositive = el => el.value.trim() !== '' && Number.isFinite(el.valueAsNumber) && el.valueAsNumber > 0;
  const format = n => Number(n.toPrecision(6)).toLocaleString('en-US', {maximumSignificantDigits: 6});
  let currentUnit = byId('weight-unit').value;
  let currentMassUnit = byId('mass-unit').value;
  let currentDivisorUnit = byId('divisor-unit').value;
  const cubicInchInCm = 2.54 ** 3;
  byId('divisor-unit').addEventListener('change', event => {
    const next = event.target.value;
    if (next === currentDivisorUnit) return;
    const el = byId('weight-divisor');
    if (el.value.trim() !== '' && Number.isFinite(el.valueAsNumber)) {
      const factor = currentDivisorUnit === 'cm3kg' ? 0.45359237 / cubicInchInCm : cubicInchInCm / 0.45359237;
      const converted = el.valueAsNumber * factor;
      if (Number.isFinite(converted)) el.value = String(Number(converted.toPrecision(12)));
    }
    currentDivisorUnit = next;
  });
  byId('mass-unit').addEventListener('change', event => {
    const next = event.target.value;
    if (next === currentMassUnit) return;
    const actual = byId('weight-actual');
    if (actual.value.trim() !== '' && Number.isFinite(actual.valueAsNumber)) {
      const converted = actual.valueAsNumber * (currentMassUnit === 'kg' ? 1 / 0.45359237 : 0.45359237);
      if (Number.isFinite(converted)) actual.value = String(Number(converted.toPrecision(12)));
    }
    currentMassUnit = next;
  });
  byId('weight-unit').addEventListener('change', event => {
    const next = event.target.value;
    if (next === currentUnit) return;
    const factor = currentUnit === 'cm' ? 1 / 2.54 : 2.54;
    ['weight-length', 'weight-width', 'weight-height'].forEach(id => {
      const el = byId(id);
      if (el.value.trim() !== '' && Number.isFinite(el.valueAsNumber)) {
        const converted = el.valueAsNumber * factor;
        if (Number.isFinite(converted)) el.value = String(Number(converted.toPrecision(12)));
      }
    });
    currentUnit = next;
  });
  function calculate() {
    const required = ids.map(byId);
    const actual = byId('weight-actual');
    if (!required.every(presentPositive) || (actual.value.trim() !== '' && !presentPositive(actual))) {
      result.textContent = 'Enter positive numbers for all three dimensions and the divisor. If provided, actual weight must also be positive.';
      result.hidden = false;
      return;
    }
    const scale = byId('weight-unit').value === 'in' ? 2.54 : 1;
    const [length, width, height, divisor] = required.map(el => el.valueAsNumber);
    const volume = (length * scale) * (width * scale) * (height * scale);
    const dimensionalKg = byId('divisor-unit').value === 'in3lb'
      ? (volume / cubicInchInCm / divisor) * 0.45359237
      : volume / divisor;
    const massUnit = byId('mass-unit').value;
    const dimensional = massUnit === 'lb' ? dimensionalKg / 0.45359237 : dimensionalKg;
    if (!Number.isFinite(volume) || !Number.isFinite(dimensional) || dimensional <= 0) {
      result.textContent = 'These numbers are outside the calculator’s range. Please check them and try again.';
      result.hidden = false;
      return;
    }
    let message = `Dimensional weight: ${format(dimensional)} ${massUnit} (calculated before carrier rounding).`;
    if (actual.value.trim() !== '') {
      const actualWeight = actual.valueAsNumber;
      const comparison = Math.max(dimensional, actualWeight);
      message += ` The larger value before carrier rounding is ${format(comparison)} ${massUnit}. Your carrier’s billable weight may differ.`;
    }
    result.textContent = message;
    result.hidden = false;
  }
  form.addEventListener('submit', event => { event.preventDefault(); calculate(); });
  form.addEventListener('input', () => { result.hidden = true; result.textContent = ''; });
  form.addEventListener('change', () => { result.hidden = true; result.textContent = ''; });
  form.addEventListener('reset', () => { result.hidden = true; result.textContent = ''; currentUnit = 'cm'; currentMassUnit = 'kg'; currentDivisorUnit = 'cm3kg'; });
  byId('weight-example').addEventListener('click', () => {
    byId('weight-unit').value = 'cm';
    currentUnit = 'cm';
    byId('mass-unit').value = 'kg';
    currentMassUnit = 'kg';
    byId('divisor-unit').value = 'cm3kg';
    currentDivisorUnit = 'cm3kg';
    [['weight-length', 40], ['weight-width', 30], ['weight-height', 20], ['weight-divisor', 5000], ['weight-actual', 3]].forEach(([id, value]) => { byId(id).value = value; });
    calculate();
  });
})();
