"use strict";

function toBigIntLE(buffer) {
  let result = 0n;
  for (let i = buffer.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(buffer[i]);
  }
  return result;
}

function toBigIntBE(buffer) {
  let result = 0n;
  for (let i = 0; i < buffer.length; i++) {
    result = (result << 8n) | BigInt(buffer[i]);
  }
  return result;
}

function toBufferLE(num, width) {
  const buffer = Buffer.alloc(width);
  let val = num;
  for (let i = 0; i < width; i++) {
    buffer[i] = Number(val & 0xffn);
    val = val >> 8n;
  }
  return buffer;
}

function toBufferBE(num, width) {
  const buffer = Buffer.alloc(width);
  let val = num;
  for (let i = width - 1; i >= 0; i--) {
    buffer[i] = Number(val & 0xffn);
    val = val >> 8n;
  }
  return buffer;
}

module.exports = { toBigIntLE, toBigIntBE, toBufferLE, toBufferBE };
