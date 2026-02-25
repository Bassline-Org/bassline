FROM node:24-slim
WORKDIR /app

COPY packages/core/src/alt/ packages/core/src/alt/
COPY app.js ./

ENV PORT=3000
EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:3000/_health').then(r=>r.json()).then(d=>{if(!d.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "app.js"]
