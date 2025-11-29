# hpp-guard (v1)
**Web Security F25 – Final Project**

**Authors:** Liz Grzyb, Mohamad Saaty, Ruohua Chen, Steven Chen

`hpp-guard` is a lightweight Express middleware that protects web applications from **HTTP Parameter Pollution (HPP)** attacks.  
It supports both **global duplicate-handling policies** and **per-parameter policies**, allowing flexible and secure request validation.

---

## Features

- **Global duplicate-handling policy**
  - `"reject"` – block polluted requests
  - `"first"` – keep first value
  - `"last"` – keep last value

- **Per-parameter policies (`paramModes`)**
  - Override the global mode for specific parameters
  - Example: `"page": "first"`, `"search": "last"`, `"token": "reject"`

- **Allowlist & multi-value exemptions**
  - Only inspect certain parameters (`allowlist`)
  - Exempt parameters allowed to be arrays (`multiValAllowed`)

- **Body support**
  - Validates `query` parameters
  - Optionally validates `application/x-www-form-urlencoded` bodies

- **Optional logging hook**
  - `onPollution(report, req)` receives detailed pollution reports

## Install
npm i hpp-guard

## Basic Usage (Global)
This will block any request where a parameter appears more than once
```js
const express = require("express");
const { hppGuard } = require("hpp-guard");

const app = express();

app.use(hppGuard({
  mode: "reject", // "reject" | "first" | "last"
}));
```

## Per-Parameter Policies
Use paramModes to override the global mode for specific parameters.
```js
app.use(hppGuard({
  mode: "reject",     // default for all parameters
  paramModes: {
    page: "first",    // keep the first ?page= value
    search: "last",   // keep the last ?search= value
    token: "reject",  // reject if duplicated
  }
}));
```

## Allow List
Only inspect specific parameters:
```js
app.use(hppGuard({
  allowlist: ["page", "search"]
}));
```

## Multi-Value Allowed Parameters
Some parameters legitimagely appear more than once. `multiValAllowed` accomodates this.
```js
app.use(hppGuard({
  multiValAllowed: ["tags"]
}));
```

## Pollution Reporting
Provide a callback to inspect pollution events
```js
app.use(hppGuard({
  onPollution: (report, req) => {
    console.log("HPP detected:", report);
  }
}));
```

## Options Cheat Sheet
| Option            | Type        | Default    | Description                                                |
| ----------------- | ----------- | ---------- | ---------------------------------------------------------- |
| `mode`            | string      | `"reject"` | Global duplicate handling: `"reject"`, `"first"`, `"last"` |
| `paramModes`      | object/null | `null`     | Per-parameter mode overrides                               |
| `allowlist`       | array/null  | `null`     | Only inspect these parameters                              |
| `multiValAllowed` | array/null  | `null`     | Parameters allowed to be arrays                            |
| `checkBody`       | boolean     | `true`     | Whether to inspect urlencoded bodies                       |
| `onPollution`     | function    | `null`     | Callback for pollution events                              |







