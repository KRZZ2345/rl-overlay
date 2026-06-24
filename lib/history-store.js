'use strict';

const fs = require('fs');
const { emptyState } = require('./history');

function loadHistory(filePath, playlist) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
    const s = JSON.parse(raw);
    if (!s || s.version !== 1 || s.playlist !== playlist || !Array.isArray(s.events)) {
      return emptyState(playlist);
    }
    return s;
  } catch {
    return emptyState(playlist);
  }
}

function saveHistory(filePath, state) {
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

module.exports = { loadHistory, saveHistory };
