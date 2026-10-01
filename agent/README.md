# Lumen Agent

Companion local mínimo para Windows, macOS y Linux. En esta entrega solo se empareja por código temporal, guarda el token en el almacén de credenciales del sistema operativo y actualiza el estado de presencia. **No tiene shell remota, no escucha trabajos ni ejecuta acciones.**

```bash
python -m pip install -e .
lumen-agent pair --server-url https://URL-DEL-PANEL --pairing-code CODIGO
lumen-agent status
lumen-agent run --interval 60
```

No uses HTTP en una red pública. HTTP se permite exclusivamente para desarrollo en localhost. Si el llavero no está disponible, no se conserva el token; configura un almacén de credenciales del sistema antes de parear. Desde el panel puedes revocar el dispositivo, tras lo cual el servidor rechaza el token.

Para probar: `python -m unittest discover -s tests`.
