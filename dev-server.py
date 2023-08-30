#!/usr/bin/env python
# -*- coding: utf-8 -*-

'''
Python dev server for ezpage site.
Dependencies: fastapi Markdown PyYAML uvicorn
'''

import logging
logging.basicConfig(format='%(asctime)s : %(filename)s : %(levelname)s : %(message)s')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

import argparse, json, os

BASEDIR = os.path.abspath(os.path.dirname(__file__))

import markdown
import yaml

from typing import Optional

import uvicorn

from fastapi import FastAPI
from fastapi.responses import Response
app = FastAPI(title='EZPage', root_path='/')

media_types = {
  'css': 'text/css',
  'html': 'text/html',
  'ico': 'image/vnd. microsoft. icon',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'js': 'text/javascript',
  'json': 'application/json',
  'md': 'text/markdown',
  'png': 'image/png',
  'txt': 'text/plain',
  'yaml': 'application/x-yaml'
}

config = yaml.load(open(f'{BASEDIR}/_config.yml', 'r'), Loader=yaml.FullLoader)
logger.debug(json.dumps(config, indent=2))

jsonld_seo = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  'description': config['description'],
  'headline': config['title'],
  'name': config['title'],
  'url': config['url']
}

seo = f'''
  <title>{config["title"]}</title>
  <meta name="generator" content="Jekyll v3.9.3" />
  <meta property="og:title" content="{config["title"]}" />
  <meta property="og:locale" content="en_US" />
  <meta name="description" content="{config["description"]}" />
  <meta property="og:description" content="{config["description"]}" />
  <link rel="canonical" href="{config["url"]}" />
  <meta property="og:url" content="{config["url"]}" />
  <meta property="og:site_name" content="{config["title"]}" />
  <meta property="og:type" content="website" />
  <script type="application/ld+json">
  {json.dumps(jsonld_seo, indent=2)}
  </script>
'''

not_found_page = open(f'{BASEDIR}/404.html', 'r').read()
header = open(f'{BASEDIR}/_includes/header.html', 'r').read()
footer = open(f'{BASEDIR}/_includes/footer.html', 'r').read()
favicon = open(f'{BASEDIR}/favicon.ico', 'rb').read()
html_template = open(f'{BASEDIR}/_layouts/default.html', 'r').read()
html_template = html_template.replace('{%- include header.html -%}', header)
html_template = html_template.replace('{%- include footer.html -%}', footer)
html_template = html_template.replace('https://rsnyder.github.io/ezpage-wc/js/index.js', 'http://localhost:5173/src/main.ts')
html_template = html_template.replace('{%- seo -%}', seo)
html_template = html_template.replace('{{ site.github.owner }}', config['github']['owner'])
html_template = html_template.replace('{{ site.github.repo }}', config['github']['repo'])
html_template = html_template.replace('{{ site.baseurl }}', '/')
  
def html_from_markdown(md):
  return html_template.replace('{{ content }}', markdown.markdown(md, extensions=['extra', 'toc']))
  
@app.get('/{path:path}')
async def serve(path: Optional[str] = None):
  path = [pe for pe in path.split('/') if pe != ''] if path else []
  ext = path[-1].split('.')[-1] if len(path) > 0 and '.' in path[-1] else None
  local_file_path = f'{BASEDIR}/{"/".join(path)}' if ext else f'{BASEDIR}/{"/".join(path)}/README.md'
  if not os.path.exists(local_file_path):
    return Response(status_code=404, content=not_found_page, media_type='text/html')
  content = favicon if ext == 'ico' else open(local_file_path, 'r').read()
  if ext is None: # markdown file
    content = html_from_markdown(content)
  media_type = media_types[ext] if ext in media_types else 'text/html'
  return Response(status_code=200, content=content, media_type=media_type)

if __name__ == '__main__':
  logger.setLevel(logging.INFO)
  parser = argparse.ArgumentParser(description='EZpage dev server')  
  parser.add_argument('--reload', type=bool, default=True, help='Reload on change')
  parser.add_argument('--port', type=int, default=8080, help='HTTP port')
  args = vars(parser.parse_args())
  
  uvicorn.run('dev-server:app', port=args['port'], log_level='info', reload=args['reload'])