# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Install ffmpeg and other required packages
RUN apt-get update && \
    apt-get install -y ffmpeg gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory to /app
WORKDIR /app

# Copy backend source code to the container
COPY . .

# Create a virtual environment and install dependencies
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Expose port for uvicorn
EXPOSE 8000

# Command to run the app with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
