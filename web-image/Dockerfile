# mayordomia-web image — nginx serving the built SPA.
# Built by the GitHub Actions workflow after `npm run build` produces dist/.
# Image is rebuilt on every push to main; the Pi pulls it with `image: ...:latest`.

FROM nginx:alpine

# dist/ is produced by `npm run build` in the same workflow before this build.
# The build context must be the repo root so this relative path resolves.
COPY dist/ /usr/share/nginx/html/:ro
COPY web-image/nginx.conf /etc/nginx/conf.d/default.conf:ro

# The web container only listens on the internal Docker network; no port
# needs to be published on the host because the cloudflared container
# connects to it via DNS alias `mayordomia-web`.
EXPOSE 80

# nginx:alpine already runs as the unprivileged `nginx` user.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --spider --quiet http://localhost/ || exit 1
