FROM nginx:alpine

# Copio la web estatica al nginx
COPY . /usr/share/nginx/html

# Uso mi configuracion de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
