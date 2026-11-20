# Reverse proxy settings

**Invariant:** Derive client address and protocol only from the direct connection and forwarding metadata controlled by trusted hops.

CIDR-based `trust proxy`, `req.ip`, and `req.secure` in this recipe are portable across Express 4.x and 5.x; the CIDRs and header policy are deployment-specific ([Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)).

## When to read

Deploy Express behind an ingress or change behavior based on `req.ip`, `req.protocol`, or `req.secure`.

**Assumptions:** The app is reachable only from a dedicated ingress subnet. The ingress terminates TLS and overwrites external forwarding headers with its own values. The example CIDR is illustrative, not a deployment default.

Set `trust proxy` from the actual network topology and last trusted hop. Configure ingress to control `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto` as appropriate. Do not use a hop count unless every path to the app has the same required topology.

## Bad

```js
app.set('trust proxy', true);
app.use((req, _res, next) => {
  req.clientAddress = req.get('X-Forwarded-For');
  next();
});
```

## Good

```js
// This subnet is assigned exclusively to the trusted ingress.
app.set('trust proxy', ['10.20.4.0/28']);
app.use((req, res, next) => {
  res.locals.transport = { clientIp: req.ip, secure: req.secure };
  next();
});
```

If the app receives direct traffic, leave proxy trust disabled for those peers and read the socket-derived values. Use a configured canonical public origin for absolute URLs; proxy trust is not host validation or an authorization boundary. Keep HTTPS redirects and cookie policy consistent with TLS termination at ingress.

## Verification

1. Use a production-equivalent ingress to send HTTP and HTTPS test requests. Assert the app derives the documented address and protocol and does not enter a redirect loop.
2. Verify the ingress overwrites supplied forwarding metadata and that an unintended direct route to the app is blocked. For deployments allowing mixed peers, verify untrusted peers do not influence the derived values.
