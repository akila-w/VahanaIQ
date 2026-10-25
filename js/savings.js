import { minDownFor } from './calculator.js?v=2.11.6';
import { DEFAULT_DOWN, DOWN_MAX } from './constants.js?v=2.11.6';

export function addMonths(date, months) {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  d.setDate(Math.min(date.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

export function savingsPlan({ price, condition, financeClass, firstRegisteredOn, down = DEFAULT_DOWN, cash = false, fees = 0, insurance = 0,
  saved = 0, income = 0, debt = 0, mode = 'percent', contribution = 20, targetDate = '' }, today = new Date()) {
  const valid = n => Number.isFinite(n) && n >= 0;
  if (!(price > 0) || !valid(price)) return { error: 'Choose a vehicle with a valid price or enter a quote first.' };
  if (![fees, insurance, saved, income, debt, contribution, down].every(valid) || down > DOWN_MAX || (mode === 'percent' && contribution > 100)) return { error: 'Enter valid positive amounts and percentages between 0 and 100.' };
  const downPct = cash ? DOWN_MAX : Math.max(down, minDownFor(condition, financeClass, firstRegisteredOn, today));
  const deposit = price * downPct / 100, target = deposit + fees + insurance;
  const remaining = Math.max(0, target - saved);
  const monthly = mode === 'percent' ? income * contribution / 100 : contribution;
  const percent = income > 0 ? monthly / income * 100 : null;
  const months = remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null;
  const date = months === null || months > 1200 ? null : addMonths(today, months);
  let required = null, targetMonths = null, targetError = '';
  if (targetDate) {
    const end = new Date(targetDate + 'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !Number.isFinite(end.getTime()) || end.getFullYear() !== +targetDate.slice(0,4) || end.getMonth()+1 !== +targetDate.slice(5,7) || end.getDate() !== +targetDate.slice(8,10)) targetError = 'Choose a valid target date.';
    else {
      targetMonths = (end.getFullYear() - today.getFullYear()) * 12 + end.getMonth() - today.getMonth();
      if (targetMonths > 0 && addMonths(today, targetMonths) > end) targetMonths--;
      if (targetMonths > 1200) targetError = 'Choose a target within the next 100 years.';
      else if (remaining === 0) required = 0;
      else if (targetMonths < 1) targetError = 'The target must allow at least one monthly contribution.';
      else required = remaining / targetMonths;
    }
  }
  return { deposit, downPct, fees, insurance, target, remaining, monthly, percent, months, date,
    progress: Math.min(100, saved / target * 100), required, targetMonths, targetError,
    requiredPercent: required !== null && income > 0 ? required / income * 100 : null,
    fitsKnownCommitments: income > 0 ? monthly <= Math.max(0, income - debt) : null };
}
