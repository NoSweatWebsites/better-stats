use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("not found")]
    NotFound,
    #[error("forbidden")]
    Forbidden,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl From<StatusCode> for AppError {
    fn from(status: StatusCode) -> Self {
        match status {
            StatusCode::FORBIDDEN => AppError::Forbidden,
            StatusCode::NOT_FOUND => AppError::NotFound,
            _ => AppError::Internal(anyhow::anyhow!("unexpected status: {status}")),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match &self {
            AppError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "database error".into()),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal error".into()),
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
