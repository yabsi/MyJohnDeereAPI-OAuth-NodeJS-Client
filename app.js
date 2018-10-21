const express = require('express');
const OAuth = require('oauth').OAuth;
const fs = require('fs-extra');

var config = {
    oAuthVersion: '1.0',
    oAuthSignatureMethod: 'HMAC-SHA1',
    oAuthNonceSize: undefined,

    /*
     * IMPORTANT: John Deere specific accept header has to be set to have oAuth working with the MyJohnDeere
     * platform. Other headers are possible depending on what the endpoint supports.
     *
     * IMPORTANT: Be aware of that not all endpoints support all content types. The 'oauth' module from
     * NPM used in this example uses the same accept header for all requests that has been specified
     * when the oauth session has been created. This means if you explicitly want to have data from another
     * endpoint in another content type you would need to establish another oauth session for that content type.
     * (Or use another library or modify the library)
     */
    oAuthCustomHeaders: {
        'Accept': 'application/vnd.deere.axiom.v3+json'
    },
    clientKey: 'johndeere-5JGkWTVGlKVAwvauu5ncj21D',
    clientSecret: '377c929064be7477d7395691b651d77eb1a96de6',
    platformBaseUri: 'https://sandboxapi.deere.com/platform/',
    authorizeCallbackUri: 'http://localhost:3000/callback'
};
var oAuthSession;
var apiCatalog;
/*
 * Build local server to allow callback for OAuth authentication
 */
var app = express();
/*
 * Store for request and access tokens
 */
var tokens = {};

var getLinkFrom = function (links, rel) {
    let l = links.find(function (link) {
        return rel === link.rel;
    });
    if (l) {
        return l.uri;
    }
    return null;
};

/*
 * 1. Call platformBaseUri with client credentials to get the API Catalog
 *
 * The OAuthSession is initialized without (undefined) requestTokenUri and accessTokenUri as we
 * will get the URIs from the API Catalog. The get request is executed without any
 * accessToken information as we need to get this during authentication.
 *
 * IMPORTANT: In order to get the OAuth working with the MyJohnDeere platform, it is
 * always necessary to set the correct Accept header as configured above!
 *
 * From the API Catalog, we need the 'oauthRequestToken', 'oauthAuthorizationRequestToken',
 * and 'oauthAccessToken' URIs to proceed.
 */

oAuthSession = new OAuth(undefined, undefined, config.clientKey, config.clientSecret,
    config.oAuthVersion, config.authorizeCallbackUri, config.oAuthSignatureMethod, config.oAuthNonceSize, config.oAuthCustomHeaders);

oAuthSession.get(config.platformBaseUri, null, null, function (error, responseData, result) {

    apiCatalog = JSON.parse(responseData);

    console.log('----- Getting OAuth URIs from API Catalog -----');
    console.log('StatusCode => ' + result.statusCode);

    apiCatalog.links.forEach(function (link) {
        if ('oauthRequestToken' === link.rel) {
            config.oauthRequestTokenUri = link.uri;
            return;
        }

        if ('oauthAuthorizeRequestToken' === link.rel) {
            config.oauthAuthorizeRequestTokenUri = link.uri;
            return;
        }

        if ('oauthAccessToken' === link.rel) {
            config.oauthAccessTokenUri = link.uri;
            return;
        }
    });

    console.log(JSON.stringify(config, null, 2));

    console.log('----- Ready to authenticate -----');
});


app.get('/oauth', function (req, res) {
    oAuthSession = new OAuth(config.oauthRequestTokenUri, config.oauthAccessTokenUri, config.clientKey, config.clientSecret,
        config.oAuthVersion, config.authorizeCallbackUri, config.oAuthSignatureMethod, config.oAuthNonceSize, config.oAuthCustomHeaders);

    console.log('----- Requesting Request Token and Secret -----');

    oAuthSession.getOAuthRequestToken(function (error, token, secret, results) {
        tokens.requestToken = token;
        tokens.requestTokenSecret = secret;
        console.log('----- Request Token and Secret Received -----');
        console.log('StatusCode => ' + results.statusCode);
        console.log(JSON.stringify(tokens, null, 2));

        console.log('----- Redirecting to oauthAuthorizeRequestTokenUri -----');

        res.send(config.oauthAuthorizeRequestTokenUri.replace('{token}', token));
    });
});


app.get('/callback', function (req, res) {
    tokens.verifier = req.query.oauth_verifier;
    tokens.accessToken = req.query.token;
    tokens.accessTokenSecret = req.query.secret;

    console.log('----- Callback - Verifier Received -----');
    console.log(JSON.stringify(tokens, null, 2));

    console.log('----- Requesting Access Token and Secret -----');

    oAuthSession.getOAuthAccessToken(tokens.requestToken, tokens.requestTokenSecret, tokens.verifier, function (error, token, secret, results) {
        tokens.accessToken = token;
        tokens.accessTokenSecret = secret;

        res.send(JSON.stringify(tokens, null, 2));
    });
});


app.get('/fields', function (req, res) {
    oAuthSession.get('https://sandboxapi.deere.com:443/platform/organizations/223031/fields', 'e857ab85-d146-4d38-b566-7c4e6cff79bd', 'Vng+hvL4t0toSM8kBApJILa4LjgRfEbLDs6Wk1syew6n/OfmxWrRBDThrTGIDAIr5VB3w5uVvV7irvhqo/tpmiPb7x6GJmds9h7XdsZF5no=', function (error, responseData, result) {
        console.log('StatusCode => ' + result.statusCode);
        console.log('----- Sample Request Response -----');

        res.send(JSON.stringify(JSON.parse(responseData), null, 2));
    });
});


app.listen(3000);

console.log('listening on http://localhost:3000');
