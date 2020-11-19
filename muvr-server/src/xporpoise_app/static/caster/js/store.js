var store = (function () {
    return {
        setItem: function(key, value){
            if(window.muvrNative){
                return window.ElectronStore.set(key, value);
            }
            else{
                return localStorage.setItem(key, JSON.stringify(value));
            }
        },
        getItem: function(key){
            if(window.muvrNative){
                return window.ElectronStore.get(key);
            }
            else{
                return JSON.parse(localStorage.getItem(key));
            }
        },
        clear: function(){
            if(window.muvrNative){
                window.ElectronStore.clear();
            }
            else{
                localStorage.clear();
            }
        }
    }

})();