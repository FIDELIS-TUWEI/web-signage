const app = require("./app");
const config = require("./utils/config");
const logger = require("./utils/logger");
const { checkTablesExist, testConnection, createTables } = require("../database/db");


const startServer = async () => {
    try {
        const connected = await testConnection();
        if (!connected) {
            logger.error('Failed to connect to the database. Exiting...');
            process.exit(1);
        }
        
        const tablesExist = await checkTablesExist();
        if (!tablesExist) {
            await createTables();
            logger.info('Database tables created successfully');
        } else {
            logger.info('Database tables already exist, skipping creation...');
        };

        app.listen(config.PORT, () => {
            logger.info(`Server running on port: ${config.PORT}`);
        });
    } catch (err) {
        logger.error('Error starting server:', err);
        process.exit(1);
    }
};

startServer();