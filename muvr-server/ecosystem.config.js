module.exports = {
  "apps": [
    {
      "exec_mode": "fork_mode",
      "script": "./bin/www",
      "name": "xporpoise-0",
      "env": {
        "PORT": 8080,
        "NODE_ENV": "production"
      }
    },
    {
      "exec_mode": "fork_mode",
      "script": "./bin/www",
      "name": "xporpoise-1",
      "env": {
        "PORT": 8081,
        "NODE_ENV": "production"
      }
    }
  ]
};
