var isMobile = (function () {
    return {
        //Don't rely on screen resolution, user agent, etc...
        detect: function () {
            var match = window.matchMedia || window.msMatchMedia;
            if (match) {
                //Checks for the existence of a "fine" high accuracy mouse attached as a input device
                var mq = match("(any-pointer:fine)");
                return !mq.matches;
            }
            return true;
        }
    }

})();