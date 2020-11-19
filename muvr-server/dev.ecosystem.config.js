module.exports = {
  "apps": [
    {
      "exec_mode": "fork_mode",
      "script": "./bin/www",
      "name": "xporpoise-0",
      "env": {
        "PORT": 9000,
        "NODE_ENV": "production"
      }
    }
  ]
};
