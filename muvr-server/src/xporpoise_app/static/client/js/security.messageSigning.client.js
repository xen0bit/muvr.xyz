var security = (function () {
    return {
        importKey: function () {
            window.crypto.subtle.importKey(
                "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
                //Pulling the private key
                JSON.parse(window.atob(location.hash.split('#')[1].split("!")[1])),
                {
                    name: "ECDSA",
                    namedCurve: "P-256",
                    hash: {name: "SHA-256"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
                },
                false, //whether the key is extractable (i.e. can be used in exportKey)
                ["sign"] //"verify" for public key import, "sign" for private key imports
            )
                .then(function (privateKey) {
                    //returns a publicKey (or privateKey if you are importing a private key)
                    connection.privateKey = privateKey;
                    security.sign();
                })
                .catch(function (err) {
                    console.error(err);
                });
        },
        sign: function () {
            var str = "Hi! If you spot a security issue with my implementation, feel free to reach out security@muvr.xyz"
            var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
            var bufView = new Uint16Array(buf);
            for (var i = 0, strLen = str.length; i < strLen; i++) {
                bufView[i] = str.charCodeAt(i);
            }
            window.crypto.subtle.sign(
                {
                    name: "ECDSA",
                    hash: {name: "SHA-256"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
                },
                connection.privateKey, //from generateKey or importKey above
                buf //ArrayBuffer of data you want to sign
            )
                .then(function (signature) {
                    //returns an ArrayBuffer containing the signature
                    //console.log(new Uint8Array(signature));
                    connection.password = btoa(String.fromCharCode.apply(null, new Uint8Array(signature)));
                })
                .catch(function (err) {
                    console.error(err);
                });
        }

    }

})();