//For use by PM2
module.exports = {
  "apps": [
    {
      "exec_mode": "fork_mode",
      "script": "./bin/www",
      "name": "muvr-server",
      "increment_var" : "PORT",
      "env": {
        "PORT": 8080,
        "NODE_ENV": "production"
      }
    }
  ]
};
