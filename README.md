# hpp-guard (v0)
** Web Security F25 Final Project **
** Liz Grzyb, Mohamad Saaty, Ruohua Chen, Steven Chen **

Minimal Express middleware to defend against HTTP Parameter Pollution in query strings.

## Install
npm i hpp-guard

## Use
```js
const express = require("express");
const { hppLite } = require("hpp-guard");

const app = express();

app.use(hppGuard({
  mode: "reject", // "reject" | "first" | "last"
}));
