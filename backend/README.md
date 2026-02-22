# FastAPI and React Fullstack Application

This project is a fullstack application that consists of a FastAPI backend and a React frontend. Below are the instructions for setting up and running both parts of the application.

## Backend Setup

1. Navigate to the `backend` directory:
   ```
   cd backend
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run the FastAPI application:
   ```
   uvicorn app.main:app --reload
   ```

4. The API will be available at `http://127.0.0.1:8000`.

## Frontend Setup

1. Navigate to the `frontend` directory:
   ```
   cd frontend
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Start the React application:
   ```
   npm start
   ```

4. The application will be available at `http://localhost:3000`.

## API Documentation

The FastAPI backend automatically generates API documentation. You can access it at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## Project Structure

```
fullstack-app
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── routes.py
│   ├── requirements.txt
│   └── README.md
├── frontend
│   ├── public
│   │   └── index.html
│   ├── src
│   │   ├── App.js
│   │   ├── components
│   │   │   └── Header.js
│   │   └── index.js
│   ├── package.json
│   └── README.md
└── README.md
```

## License

This project is licensed under the MIT License.