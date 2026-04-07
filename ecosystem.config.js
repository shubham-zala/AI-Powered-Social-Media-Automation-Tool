module.exports = {
    apps: [
        {
            name: "miracles-social-media-backend",
            script: "./index.js",
            cwd: "./backend",
            watch: false,
            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
            }
        },
        {
            name: "miracles-social-media-frontend",
            script: "npm",
            args: "run preview -- --host",
            cwd: "./frontend",
            watch: false,
            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
            }
        }
    ]
};
