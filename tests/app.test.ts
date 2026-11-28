import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  APP_TELEGRAM_URL,
  APP_VERSION_CODE,
  APP_VERSION_NAME,
} from '@/src/lib/appInfo';
import { clusterConsecutiveCalls, filterCalls, groupCalls } from '@/src/lib/calls';
import {
  countLinkedNumbersByName,
  findSiblingContactProfiles,
  getContactKey,
  parseCsvContacts,
  parseVCardContacts,
} from '@/src/lib/contacts';
import {
  detectCarrier,
  estimateCallCostEtb,
  normaliseEthPhone,
  type TariffConfig,
} from '@/src/lib/ethiopia';
import {
  getEthiopianMonthName,
  toEthiopianDate,
  toGregorianDate,
} from '@/src/lib/ethiopianCalendar';
import { buildVersionedBackupJson, callsToCsv } from '@/src/lib/export';
import { initials, isPhoneLikeName } from '@/src/lib/format';
import {
  applyDailyAppOpen,
  computeContactStatuses,
  eatDateDiffDays,
  getEffectiveStreak,
  toEatDateString,
} from '@/src/lib/gamification';
import { matchHelpFaq, searchHelpFaqs } from '@/src/lib/helpBotFaq';
import {
  buildImportPreview,
  CURRENT_BACKUP_SCHEMA_VERSION,
  parseBackupImport,
  parseCallImport,
} from '@/src/lib/import';
import { quietContactsAnalysis, typicalIntervalDays } from '@/src/lib/reminders';
import {
  getPinLockoutDelayMs,
  hashPin,
  isValidPinHash,
  sanitizeSocialUsername,
  verifyPin,
} from '@/src/lib/security';
import { computeTotals } from '@/src/lib/stats';
import { parseUpdateManifest } from '@/src/lib/updateChecker';
import type { CallRecord, StreakRecord } from '@/src/types/call';

const ROOT = process.cwd();

function makeCall(overrides: Partial<CallRecord> = {}): CallRecord {
  return {
    id: 'call-1',
    number: '+251941505775',
    name: 'Melek',
    direction: 'outgoing',
    sim: 'SIM 1',
    timestamp: Date.UTC(2026, 2, 15, 10, 0, 0),
    duration: 120,
    note: null,
    tag: null,
    ...overrides,
  };
}

test('ethiopian phone normalisation and carrier detection handle ETC, Safaricom, landline, and international', () => {
  assert.equal(normaliseEthPhone('+251 941 505 775'), '0941505775');
  assert.equal(normaliseEthPhone('00251712345678'), '0712345678');
  assert.equal(normaliseEthPhone('911248890'), '0911248890');
  assert.equal(normaliseEthPhone('+1 (415) 555-0199'), '+14155550199');

  assert.equal(detectCarrier('+251941505775'), 'ETC');
  assert.equal(detectCarrier('0712345678'), 'SFC');
  assert.equal(detectCarrier('0115512233'), 'Landline');
  assert.equal(detectCarrier('+447911123456'), 'International / Other');
});

test('tariff billing estimates outgoing cost for per-second and per-minute modes and ignores non-outgoing', () => {
  const perSecond: TariffConfig = {
    sim1RatePerMin: 0.6,
    sim2RatePerMin: 0.9,
    billingMode: 'per-second',
    monthlyBudgetEtb: 500,
  };
  const perMinute: TariffConfig = {
    ...perSecond,
    billingMode: 'per-minute',
  };

  assert.equal(estimateCallCostEtb({ direction: 'outgoing', duration: 90, sim: 'SIM 1' }, perSecond), 0.9);
  assert.equal(estimateCallCostEtb({ direction: 'outgoing', duration: 61, sim: 'SIM 1' }, perMinute), 1.2);
  assert.equal(estimateCallCostEtb({ direction: 'outgoing', duration: 60, sim: 'SIM 2' }, perSecond), 0.9);
  assert.equal(estimateCallCostEtb({ direction: 'incoming', duration: 300, sim: 'SIM 1' }, perSecond), 0);
  assert.equal(estimateCallCostEtb({ direction: 'missed', duration: 0, sim: 'SIM 1' }, perSecond), 0);
});

test('call filtering, grouping, clustering, and totals aggregate consistently across number formats', () => {
  const baseTs = Date.UTC(2026, 2, 15, 12, 0, 0);
  const calls: CallRecord[] = [
    makeCall({ id: 'c1', number: '+251941505775', name: 'Melek', direction: 'outgoing', duration: 60, timestamp: baseTs }),
    makeCall({ id: 'c2', number: '0941505775', name: 'Melek', direction: 'outgoing', duration: 45, timestamp: baseTs - 60_000 }),
    makeCall({ id: 'c3', number: '0712345678', name: 'Dawit Bekele', direction: 'incoming', duration: 180, tag: 'Work', timestamp: baseTs - 120_000 }),
    makeCall({ id: 'c4', number: '0922310442', name: 'Sara', direction: 'missed', duration: 0, note: 'urgent callback', timestamp: baseTs - 86_400_000 }),
  ];

  // Searching local format matches +2519... call
  assert.equal(filterCalls(calls, '0941505775').length, 2);
  // Fuzzy name typo tolerance (editDistance <= 2)
  assert.equal(filterCalls(calls, 'Melec').length, 2);
  // Note & tag match
  assert.equal(filterCalls(calls, 'urgent').length, 1);
  assert.equal(filterCalls(calls, 'Work').length, 1);

  const clusters = clusterConsecutiveCalls(calls, getContactKey);
  assert.equal(clusters.length, 3);
  assert.equal(clusters[0].calls.length, 2);
  assert.equal(clusters[0].totalDuration, 105);

  const sections = groupCalls(calls);
  assert.equal(sections.length, 2);

  const totals = computeTotals(calls);
  assert.equal(totals.totalCalls, 4);
  assert.equal(totals.outgoingCount, 2);
  assert.equal(totals.incomingCount, 1);
  assert.equal(totals.missedCount, 1);
  assert.equal(totals.totalDuration, 285);
  assert.equal(totals.avgDuration, 95); // 285 / 3 answered
  assert.equal(totals.uniqueContacts, 4);
});

test('ethiopian calendar converts known Enkutatash and Pagume boundary dates accurately', () => {
  // Gregorian 2024-09-11 is Ethiopian 2017-01-01 (Meskerem 1, 2017)
  const enkutatash = toEthiopianDate(new Date(2024, 8, 11));
  assert.deepEqual(enkutatash, { year: 2017, month: 1, day: 1 });
  assert.equal(getEthiopianMonthName(1, 'english'), 'Meskerem');

  // Round-trip back to Gregorian
  const gc = toGregorianDate(2017, 1, 1);
  assert.deepEqual(gc, { year: 2024, month: 9, day: 11 });

  // Pagume 5, 2017 -> 2025-09-10
  const pagumeEnd = toEthiopianDate(new Date(2025, 8, 10));
  assert.deepEqual(pagumeEnd, { year: 2017, month: 13, day: 5 });
  assert.equal(getEthiopianMonthName(13, 'english'), 'Pagume');
});

test('gamification EAT timezone, daily streak progression, reset, and contact streaks calculate properly', () => {
  // 2026-03-15 22:00 UTC is 2026-03-16 01:00 EAT (UTC+3)
  const lateUtcMs = Date.UTC(2026, 2, 15, 22, 0, 0);
  assert.equal(toEatDateString(lateUtcMs), '2026-03-16');
  assert.equal(eatDateDiffDays('2026-03-15', '2026-03-18'), 3);

  const day1Ms = Date.UTC(2026, 2, 10, 9, 0, 0);
  const day2Ms = Date.UTC(2026, 2, 11, 9, 0, 0);
  const day4Ms = Date.UTC(2026, 2, 13, 9, 0, 0);

  const emptyStreak: StreakRecord = {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    totalActiveDays: 0,
  };

  const open1 = applyDailyAppOpen(emptyStreak, [], day1Ms);
  assert.equal(open1.streaks.currentStreak, 1);
  assert.equal(open1.changed, true);

  // Re-opening same EAT day does not double-award points
  const open1Again = applyDailyAppOpen(open1.streaks, open1.history, day1Ms + 3_600_000);
  assert.equal(open1Again.addedPoints.length, 0);
  assert.equal(open1Again.streaks.currentStreak, 1);

  // Consecutive EAT day increments streak
  const open2 = applyDailyAppOpen(open1.streaks, open1.history, day2Ms);
  assert.equal(open2.streaks.currentStreak, 2);
  assert.equal(open2.streaks.longestStreak, 2);

  // Skipping day 3 resets currentStreak to 1 while preserving longestStreak
  const open4 = applyDailyAppOpen(open2.streaks, open2.history, day4Ms);
  assert.equal(open4.streaks.currentStreak, 1);
  assert.equal(open4.streaks.longestStreak, 2);

  // Effective streak after missed day reports 0 active current streak
  const stale = getEffectiveStreak(open2.streaks, day4Ms);
  assert.equal(stale.currentStreak, 0);
  assert.equal(stale.longestStreak, 2);

  // Contact streak status across 3 consecutive EAT days (09:00 EAT each day)
  const contactCalls: CallRecord[] = [
    makeCall({ id: 'cs1', number: '0911000111', direction: 'outgoing', duration: 60, timestamp: Date.UTC(2026, 2, 11, 6, 0, 0) }),
    makeCall({ id: 'cs2', number: '0911000111', direction: 'incoming', duration: 45, timestamp: Date.UTC(2026, 2, 12, 6, 0, 0) }),
    makeCall({ id: 'cs3', number: '+251911000111', direction: 'outgoing', duration: 90, timestamp: Date.UTC(2026, 2, 13, 6, 0, 0) }),
  ];
  const statuses = computeContactStatuses(contactCalls, {}, 15, Date.UTC(2026, 2, 13, 12, 0, 0));
  const status = statuses['0911000111'];
  assert.ok(status);
  assert.equal(status.currentStreak, 3);
  assert.equal(status.longestStreak, 3);
  assert.equal(status.totalConnectedDays, 3);
});

test('security PIN hashing, verification, lockout backoff, and social username sanitization', async () => {
  const hash = await hashPin('2580');
  assert.equal(isValidPinHash(hash), true);
  assert.equal(await verifyPin('2580', hash), true);
  assert.equal(await verifyPin('1234', hash), false);
  assert.equal(await verifyPin('abcd', hash), false);
  assert.equal(isValidPinHash('invalid-hash'), false);

  await assert.rejects(() => hashPin('123'));

  assert.equal(getPinLockoutDelayMs(4), 0);
  assert.equal(getPinLockoutDelayMs(5), 30_000);
  assert.equal(getPinLockoutDelayMs(6), 60_000);
  assert.equal(getPinLockoutDelayMs(7), 300_000);
  assert.equal(getPinLockoutDelayMs(10), 900_000);

  assert.equal(sanitizeSocialUsername('@callanalyzer_eth'), 'callanalyzer_eth');
  assert.equal(sanitizeSocialUsername('https://t.me/callanalyzer_eth/'), 'callanalyzer_eth');
});

test('CSV export/import and versioned JSON backup round-trip without duplicate calls', () => {
  const baseTs = Date.UTC(2026, 2, 14, 15, 30, 0);
  const originalCalls: CallRecord[] = [
    makeCall({ id: 'b1', number: '0941505775', name: 'Melek', direction: 'outgoing', duration: 125, note: 'Dinner, 7pm', tag: 'Family', timestamp: baseTs }),
    makeCall({ id: 'b2', number: '0712345678', name: 'Dawit', direction: 'incoming', duration: 64, timestamp: baseTs - 3_600_000 }),
  ];

  const csv = callsToCsv(originalCalls);
  const csvResult = parseCallImport(csv, 'calls.csv');
  assert.equal(csvResult.invalid, 0);
  assert.equal(csvResult.calls.length, 2);
  assert.equal(csvResult.calls[0].note, 'Dinner, 7pm');

  const backupJson = buildVersionedBackupJson({
    calls: originalCalls,
    tags: ['Family', 'VIP'],
    streaks: { currentStreak: 4, longestStreak: 7, lastActiveDate: '2026-03-14', totalActiveDays: 12 },
  });
  const pkg = parseBackupImport(backupJson, 'backup.json');
  assert.equal(pkg.isBackup, true);
  assert.equal(pkg.schemaVersion, CURRENT_BACKUP_SCHEMA_VERSION);
  assert.equal(pkg.calls.length, 2);
  assert.deepEqual(pkg.tags, ['Family', 'VIP']);
  assert.equal(pkg.streaks?.longestStreak, 7);

  // Preview against existing calls identifies duplicates without inflating newCallsCount
  const preview = buildImportPreview('backup.json', pkg, {
    calls: originalCalls,
    contacts: {},
    availableTags: ['Family'],
    scheduledCalls: [],
  });
  assert.equal(preview.duplicateCallsCount, 2);
  assert.equal(preview.newCallsCount, 0);
  assert.equal(preview.newTagsCount, 1); // VIP
});

test('quiet contacts rhythm detection identifies overdue vs dormant contacts', () => {
  const now = new Date(Date.UTC(2026, 3, 20, 12, 0, 0));
  const day = 86_400_000;
  // Answered calls 34, 30, 26, 22 days ago -> interval 4 days, overdue by 22 days
  const calls: CallRecord[] = [
    makeCall({ id: 'q1', number: '0911223344', name: 'Abel', direction: 'outgoing', duration: 120, timestamp: now.getTime() - 34 * day }),
    makeCall({ id: 'q2', number: '0911223344', name: 'Abel', direction: 'incoming', duration: 110, timestamp: now.getTime() - 30 * day }),
    makeCall({ id: 'q3', number: '0911223344', name: 'Abel', direction: 'outgoing', duration: 95, timestamp: now.getTime() - 26 * day }),
    makeCall({ id: 'q4', number: '0911223344', name: 'Abel', direction: 'incoming', duration: 80, timestamp: now.getTime() - 22 * day }),
  ];

  assert.equal(typicalIntervalDays(calls), 4);
  const analysis = quietContactsAnalysis(calls, { now });
  assert.equal(analysis.active.length, 1);
  assert.equal(analysis.active[0].typicalIntervalDays, 4);
  assert.equal(analysis.active[0].isDormant, false);
});

test('help bot FAQ matcher resolves key topics, greetings, and search results', () => {
  const biometric = matchHelpFaq('how do i enable fingerprint auto lock?');
  assert.ok(biometric.matched);
  assert.match(biometric.matched.id, /pin-lock|biometric|security/i);

  const fonts = matchHelpFaq('modern fonts appearance');
  assert.ok(fonts.matched);
  assert.equal(fonts.matched.category, 'appearance');

  const greeting = matchHelpFaq('hello');
  assert.equal(greeting.isGreeting, true);
  assert.ok(greeting.related.length >= 3);

  const hits = searchHelpFaqs('ethiopian calendar', 5);
  assert.ok(hits.length > 0);
});

test('update manifest validator rejects insecure HTTP URLs and accepts valid HTTPS manifest', () => {
  assert.equal(
    parseUpdateManifest({
      versionCode: 15,
      versionName: '1.0.7',
      apkUrl: 'http://example.com/app.apk',
      notes: 'insecure',
    }),
    null,
  );
  const valid = parseUpdateManifest({
    versionCode: 15,
    versionName: '1.0.7',
    apkUrl: 'https://youthful-limiter-kjk7s.web.app/downloads/call-analyzer-eth-1.0.7.apk',
    notes: 'Release 1.0.7',
    mandatory: false,
  });
  assert.ok(valid);
  assert.equal(valid.versionCode, 15);
  assert.equal(valid.versionName, '1.0.7');
});

test('release v1.0.7 Build 15 versions and Telegram URL stay synchronized across app, package, Android, and version.json', () => {
  assert.equal(APP_VERSION_NAME, '1.0.7');
  assert.equal(APP_VERSION_CODE, 15);
  assert.equal(APP_TELEGRAM_URL, 'https://t.me/callanalyzer_eth');

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  assert.equal(pkg.version, '1.0.7');

  const gradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8');
  assert.match(gradle, /\bversionCode\s+15\b/);
  assert.match(gradle, /\bversionName\s+"1\.0\.7"/);

  const versionJson = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public/version.json'), 'utf8'),
  ) as {
    versionCode: number;
    versionName: string;
    apkUrl: string;
  };
  assert.equal(versionJson.versionCode, 15);
  assert.equal(versionJson.versionName, '1.0.7');
  assert.match(versionJson.apkUrl, /^https:\/\/.*1\.0\.7\.apk$/);
});

test('contact avatar initials handle named contacts and suppress +2 / digits for phone-only numbers', () => {
  assert.equal(initials('Abel', '+251911223344'), 'AB');
  assert.equal(initials('Abel Tesfaye', '+251911223344'), 'AT');
  assert.equal(initials('Amane', '0922334455'), 'AM');

  // Phone-only entries must NEVER show "+2" or digits
  assert.equal(initials('+251941505775', '+251941505775'), '');
  assert.equal(initials('0941505775', '+251941505775'), '');
  assert.equal(initials(null, '+251941505775'), '');
  assert.equal(initials('Unknown', '0911223344'), '');
  assert.equal(initials('*804#', '*804#'), '');

  assert.equal(isPhoneLikeName('+251941505775', '+251941505775'), true);
  assert.equal(isPhoneLikeName('Abel', '+251911223344'), false);
});

test('multi-number contacts like Amane with two phones are preserved in vCard, CSV, and sibling linking', () => {
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Amane',
    'TEL;TYPE=CELL:+251911223344',
    'TEL;TYPE=WORK:0712345678',
    'END:VCARD',
  ].join('\n');

  const vcardProfiles = parseVCardContacts(vcf);
  assert.equal(vcardProfiles.length, 2);
  assert.equal(vcardProfiles[0].name, 'Amane');
  assert.equal(vcardProfiles[1].name, 'Amane');
  assert.deepEqual(
    vcardProfiles.map((p) => p.key),
    ['0911223344', '0712345678'],
  );

  const csv = [
    'Name,Phone 1 - Value,Phone 2 - Value',
    'Amane,+251911223344,0712345678',
    'Abel,0945001872,',
  ].join('\n');
  const csvProfiles = parseCsvContacts(csv);
  assert.equal(csvProfiles.length, 3);
  assert.deepEqual(
    csvProfiles.filter((p) => p.name === 'Amane').map((p) => p.key),
    ['0911223344', '0712345678'],
  );

  const map = Object.fromEntries(csvProfiles.map((p) => [p.key, p]));
  const siblings = findSiblingContactProfiles(map, '0911223344', 'Amane');
  assert.equal(siblings.length, 1);
  assert.equal(siblings[0].key, '0712345678');

  const counts = countLinkedNumbersByName(csvProfiles);
  assert.equal(counts.get('amane'), 2);
  assert.equal(counts.get('abel'), 1);
});

test('Android App Shortcuts XML, manifest registration, labels, and vector icons are wired cleanly', () => {
  const manifest = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  assert.match(manifest, /android:name="android\.app\.shortcuts"/);
  assert.match(manifest, /android:resource="@xml\/shortcuts"/);

  const shortcutsXml = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/res/xml/shortcuts.xml'),
    'utf8',
  );
  const stringsXml = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/res/values/strings.xml'),
    'utf8',
  );

  for (const id of ['reminders', 'analytics', 'usage', 'calendar']) {
    assert.match(shortcutsXml, new RegExp(`android:shortcutId="shortcut_${id}"`));
    assert.match(shortcutsXml, new RegExp(`callanalyzer://shortcut/${id}`));
    assert.match(stringsXml, new RegExp(`name="shortcut_${id}_short"`));
    assert.match(stringsXml, new RegExp(`name="shortcut_${id}_long"`));
    assert.equal(
      fs.existsSync(
        path.join(ROOT, `android/app/src/main/res/drawable/ic_shortcut_${id}.xml`),
      ),
      true,
    );
  }
});
