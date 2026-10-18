# Computer Graphics Practicum

A collection of Computer Graphics practicum projects, covering Practicum 1 through Practicum 7 plus the UTS Meteor Defense midterm project.

## Project Structure

```text
Grafika Komputer/
├── practicum1/
├── practicum2/
├── practicum3/
├── practicum4/
├── practicum5/
├── practicum6/
├── practicum7/
├── midterm/
├── scripts/
├── index.html
├── styles.css
├── app.js
├── package.json
├── package-lock.json
└── vite.config.js
```

Each practicum contains its own HTML, JavaScript, and CSS files. Practicum 6, Practicum 7, and the UTS midterm project use Three.js and are integrated into the root Vite project.

## Getting Started

Install the dependencies from the project root:

```sh
npm install
```

Run the project locally:

```sh
npm run dev
```

Then open the local URL shown by Vite.

## Build

Build the project for production:

```sh
npm run build
```

The production files will be generated in the `deploy/` folder.

## Preview

To preview the production build locally:

```sh
npm run preview
```
