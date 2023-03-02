# OIDC Checklist for Client side Relying Party

## Id token (2.0)

### Claims:

iss: Required
sub: Required
aud: Required, MUST contain the client_id of the Relying Party as an audience value.
exp: Required, MUST NOT be accepted if it has passed. (can have a leeway of short period, aka skew)
iat: Required
auth_time: Required IF `max_age` is specified in the Authentication Request OR `auth_time` is requested as an Essential claim.
nonce: MUST be validated if peresent in Id token.
azp: if present, MUST contain the client_id of the Relying Party as an audience value.

Any claims that are not understood MUST be ignored.

## Authorization endpoint (3.1.2)

Communication with the Authorization Endpoint MUST utilize TLS.

## Authentication Request (3.1.2.1)

### Request Parameters:

scope: Required, MUST contain `openid` as a scope value. Scope values that are not understood MUST be ignored.
response_type: Required
client_id: Required
redirect_uri: Required, MUST match the redirect_uri registered for the client_id.
state: RECOMMENDED
nonce: RECOMMENDED

## Authentication Response Validation (3.1.2.7.)

When using the Authorization Code Flow, the Client MUST validate the response according to RFC 6749, especially Sections 4.1.2 and 10.12.

code: REQUIRED, MUST NOT be used more than once by the client.
state: REQUIRED, if present in the Authentication Request, MUST be the same value as the state parameter in the Authentication Response.

The client MUST ignore unrecognized response parameters.

The client MUST implement CSRF protection for its redirection URI.
This is typically accomplished by requiring any request sent to the
redirection URI endpoint to include a value that binds the request to
the user-agent's authenticated state (e.g., a hash of the session
cookie used to authenticate the user-agent). The client SHOULD
utilize the "state" request parameter to deliver this value to the
authorization server when making an authorization request.

# Token Endpoint (3.1.3)

Communication with the Token Endpoint MUST utilize TLS.

## Token Request Validation (3.1.3.5)

The Client MUST validate the Token Response as follows:

Follow the validation rules in RFC 6749, especially those in Sections 5.1 and 10.12.
Follow the ID Token validation rules in Section 3.1.3.7.
Follow the Access Token validation rules in Section 3.1.3.8.

### Succesful response:

access_token: REQUIRED
token_type: REQUIRED, MUST be `Bearer`
expires_in: RECOMMENDED
refresh_token: OPTIONAL
scope: OPTIONAL

The client MUST ignore unrecognized value names in the response.

## ID token validation (3.1.2.7)

1. The Issuer Identifier for the OpenID Provider (which is typically obtained during Discovery) MUST exactly match the value of the iss (issuer) Claim.
1. The Client MUST validate that the aud (audience) Claim contains its client_id value registered at the Issuer identified by the iss (issuer) Claim as an audience. The aud (audience) Claim MAY contain an array with more than one element. The ID Token MUST be rejected if the ID Token does not list the Client as a valid audience, or if it contains additional audiences not trusted by the Client.
1. If the ID Token contains multiple audiences, the Client SHOULD verify that an azp Claim is present.
1. If an azp (authorized party) Claim is present, the Client SHOULD verify that its client_id is the Claim Value.
1. If the ID Token is received via direct communication between the Client and the Token Endpoint (which it is in this flow), the TLS server validation MAY be used to validate the issuer in place of checking the token signature. The Client MUST validate the signature of all other ID Tokens according to JWS [JWS] using the algorithm specified in the JWT alg Header Parameter. The Client MUST use the keys provided by the Issuer.
1. The alg value SHOULD be the default of RS256 or the algorithm sent by the Client in the id_token_signed_response_alg parameter during Registration.
1. The current time MUST be before the time represented by the exp Claim.
1. If a nonce value was sent in the Authentication Request, a nonce Claim MUST be present and its value checked to verify that it is the same value as the one that was sent in the Authentication Request. The Client SHOULD check the nonce value for replay attacks. The precise method for detecting replay attacks is Client specific.

## Refresh Token Validation

1. its iss Claim Value MUST be the same as in the ID Token issued when the original authentication occurred,
1. its sub Claim Value MUST be the same as in the ID Token issued when the original authentication occurred,
1. its iat Claim MUST represent the time that the new ID Token is issued,
1. its aud Claim Value MUST be the same as in the ID Token issued when the original authentication occurred,
1. if the ID Token contains an auth_time Claim, its value MUST represent the time of the original authentication - not the time that the new ID token is issued,
1. its azp Claim Value MUST be the same as in the ID Token issued when the original authentication occurred; if no azp Claim was present in the original ID Token, one MUST NOT be present in the new ID Token, and
   otherwise, the same rules apply as apply when issuing an ID Token at the time of the original authentication.
