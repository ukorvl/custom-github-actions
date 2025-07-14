FROM mcr.microsoft.com/playwright:v1.53.2

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
WORKDIR /app

ARG NODE_VERSION=24

# hadolint ignore=DL3008
RUN apt-get remove -y nodejs && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y --no-install-recommends nodejs jq perl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g npm@latest && \
    node -v && npm -v
