// Run with: node --test src/utils/
import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidEmail, checkNewPassword } from './validation.js'

test('email format check', () => {
  for (const ok of ['meera@gmail.com', ' a.b+c@x.co.in ']) assert.equal(isValidEmail(ok), true)
  for (const bad of ['', null, undefined, 'meera', 'meera@', '@gmail.com', 'a b@x.com', 'a@b', 'a@b.c']) assert.equal(isValidEmail(bad), false)
})

test('new password rules', () => {
  assert.equal(checkNewPassword('Newpass456', 'Newpass456', 'Password123'), '')
  assert.match(checkNewPassword('short1', 'short1'), /at least 8/)
  assert.match(checkNewPassword('onlyletters', 'onlyletters'), /letter and one number/)
  assert.match(checkNewPassword('12345678', '12345678'), /letter and one number/)
  assert.match(checkNewPassword('Newpass456', 'Newpass457'), /do not match/)
  assert.match(checkNewPassword('Password123', 'Password123', 'Password123'), /different/)
  assert.equal(checkNewPassword('Newpass456', 'Newpass456'), '')   // current password not supplied (reset flow)
})
