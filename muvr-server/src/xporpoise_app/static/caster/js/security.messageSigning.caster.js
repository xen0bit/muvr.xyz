var security = (function () {
    return {
        generateKey: function () {
            window.crypto.subtle.generateKey(
                {
                    name: "ECDSA",
                    namedCurve: "P-256", //can be "P-256", "P-384", or "P-521"
                },
                true, //whether the key is extractable (i.e. can be used in exportKey)
                ["sign", "verify"] //can be any combination of "sign" and "verify"
            )
                .then(function (key) {
                    //returns a keypair object
                    //console.log(key);
                    //Save the public key to the caster
                    connection.publicKey = key.publicKey;
                    //Save the exported private key so we can pass it to the client
                    security.exportKey(key.privateKey);
                })
                .catch(function (err) {
                    console.error(err);
                });
        },
        exportKey: function (privateKey) {
            window.crypto.subtle.exportKey(
                "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
                privateKey //can be a publicKey or privateKey, as long as extractable was true
            )
                .then(function (keydata) {
                    //returns the exported key data
                    //console.log(keydata);
                    connection.exportedPrivateKey = window.btoa(JSON.stringify(keydata));
                    //console.log(connection.exportedPrivateKey.length);
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
                    hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
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