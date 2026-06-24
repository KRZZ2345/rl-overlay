'use strict';

function stdev(nums) {
  if (nums.length === 0) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function consistencyScore(events, n = 20) {
  const last = events.slice(Math.max(0, events.length - n));
  const sd = stdev(last.map((e) => e.delta));
  const score = Math.round(100 - Math.min(100, sd));
  let grade;
  if (score >= 85) grade = 'A+';
  else if (score >= 70) grade = 'A';
  else if (score >= 55) grade = 'B';
  else if (score >= 40) grade = 'C';
  else grade = 'D';
  return { score, grade };
}

function confidence(events, n = 10) {
  const last = events.slice(Math.max(0, events.length - n));
  if (last.length === 0) return 0;
  const wins = last.filter((e) => e.win).length;
  const winrate = wins / last.length;
  let streak = 0;
  for (let i = last.length - 1; i >= 0 && last[i].win; i--) streak++;
  return Math.round(winrate * 70 + (Math.min(streak, 5) / 5) * 30);
}

function tilt(events, n = 5) {
  const last = events.slice(Math.max(0, events.length - n));
  const losses = last.filter((e) => !e.win).length;
  const lastIsLoss = last.length > 0 && !last[last.length - 1].win;
  const tilted = losses >= 3 && lastIsLoss;
  return { tilted, reason: tilted ? `${losses} défaites récentes — fais une pause` : '' };
}

module.exports = { consistencyScore, confidence, tilt };
