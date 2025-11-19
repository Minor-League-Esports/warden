# Base Image: Start with a Nodejs base image
FROM node:22-alpine

# Setup directories
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./

# Install pnpm
RUN npm install -g corepack

# Switch to node user
USER node

# Install node packages
RUN yarn install

# Copy project
COPY --chown=node:node . .

# Setup config.json
# RUN cp example/config_example.json config.json
# RUN sed -i "s|<TOKEN>|token|g" ./config.json
# RUN sed -i "s|<CLIENT ID>|clientid|g" ./config.json
# RUN sed -i "s|<GUILD ID>|guildid|g" ./config.json
# RUN sed -i "s|<OPS GUILD>|opsguild|g" ./config.json
# RUN sed -i "s|<OPS CHANNEL>|opschannel|g" ./config.json
# RUN sed -i "s|<CASE CHANNEL>|casechannel|g" ./config.json
# RUN sed -i "s|<GUILD LIST>|\"server 1\", \"server 2\", \"server 3\"|g" ./config.json
# RUN cat config.json

# Start the bot
CMD ["yarn", "start"]