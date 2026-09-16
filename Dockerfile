# Use the official Python 3.11 slim image
FROM python:3.11-slim

# Set system environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies (needed for compiling certain python modules if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy all project files into the container
COPY . /app/

# Expose the Flask web server port and Flower server port
EXPOSE 8080
EXPOSE 5040

# Launch the Flask app
CMD ["python", "app.py"]
