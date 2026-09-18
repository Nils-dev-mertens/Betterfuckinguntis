# Landing page for the APK download — static files only, no build step.
# Build:   docker build -t betteruntis-site .
# Run:     docker run -d -p 8080:80 betteruntis-site
FROM nginx:1.27-alpine

COPY website/ /usr/share/nginx/html/

EXPOSE 80
