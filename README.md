# 🚂 CTC Online — Simulador Ferroviario Multijugador

Simulador de Control de Tráfico Centralizado (CTC) en tiempo real para múltiples jugadores.

## Roles

| Rol | Sigla | Máx | Descripción |
|-----|-------|-----|-------------|
| Responsable de Circulación | RC | 5 | Controla señales, desvíos e itinerarios |
| Centro de Gestión Operativa | CGO | 5 | Supervisa el tráfico (solo lectura) |
| Maquinista | MAQ | 20 | Conduce trenes por la línea |

## Escenario: La Bazagona

- 7 estaciones: Aguaverde → Peñaflor → Montesol → La Bazagona → Rioseco → Valdehierro → Cerro Alado
- Vía única: tramo Aguaverde – Montesol (est. 1-3)
- Doble vía: tramo Montesol – Cerro Alado (est. 3-7)
- 78 km de línea

## Instalación local

```bash
# 1. Instalar dependencias
npm install

# 2. Arrancar servidor
npm start

# 3. Abrir en navegador
# http://localhost:3000
```

## Despliegue en Railway.app (recomendado)

1. Sube el proyecto a un repositorio de GitHub
2. Ve a [railway.app](https://railway.app) y crea una cuenta
3. New Project → Deploy from GitHub repo
4. Railway detectará automáticamente Node.js
5. El puerto se configura solo con la variable `PORT`
6. Comparte la URL con los demás jugadores

### Alternativa: Render.com

1. New Web Service → conectar repo GitHub
2. Build command: `npm install`
3. Start command: `npm start`
4. Free tier disponible

## Cómo jugar

### Crear partida
1. Entra en la web
2. Click "Crear Partida"
3. Pon tu nombre, elige rol, crea la sala
4. Comparte el código de 6 caracteres con los demás
5. Cuando estén todos, pulsa "Iniciar Partida"

### Unirse
1. Entra en la web
2. Click "Unirse a Partida"
3. Introduce el código y tu nombre
4. Elige rol y únete

### Controles del Maquinista
- **↑ / W**: Aumentar tracción
- **↓ / S**: Aumentar freno
- **← / A**: Reducir tracción
- **→ / D**: Reducir freno
- **Espacio**: Freno de emergencia

### Controles del RC
- Selecciona herramienta en la barra superior (señales, desvíos)
- Click en el elemento del videográfico para actuar
- Sin herramienta seleccionada: click muestra información

## Arquitectura técnica

```
Servidor (Node.js + Socket.io)
├── GameEngine: simulación ferroviaria (señales, bloques, trenes)
├── Room Manager: salas de juego y lobby
└── Socket.io: comunicación bidireccional en tiempo real

Clientes (HTML5 + Canvas)
├── RC/CGO: Videográfico CTC completo
├── Maquinista: Vista lateral + cabina simplificada
└── Comunicaciones: mensajes predefinidos tipo radio
```

## Fases del proyecto

- [x] **Fase 1**: Lobby + CTC compartido + señales RC + trenes automáticos
- [ ] **Fase 2**: Maquinista manual (cabina + vista lateral)
- [ ] **Fase 3**: Mensajes predefinidos completos
- [ ] **Fase 4**: Escenarios configurables + evaluación

## Estructura de archivos

```
ctc-online/
├── package.json
├── server.js                    # Servidor Express + Socket.io
├── game/
│   ├── GameEngine.js           # Motor de simulación ferroviaria
│   └── scenarios/
│       └── bazagona.js         # Escenario La Bazagona
├── public/
│   ├── index.html              # Lobby / landing page
│   ├── game.html               # Vista de juego (todos los roles)
│   ├── css/
│   │   └── style.css           # Estilos completos
│   └── js/
│       ├── lobby.js            # Lógica del lobby
│       ├── ctc-renderer.js     # Renderizado canvas CTC + lateral + velocímetro
│       └── game-client.js      # Cliente principal del juego
└── README.md
```
