import React from "react";
import { Box, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const EmptyState = ({
  message = "No data available.",
  icon: Icon = InfoOutlinedIcon,
}) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      p={4}
      minHeight="200px"
      textAlign="center"
      sx={{
        backgroundColor: "background.paper",
        borderRadius: 2,
        border: "1px dashed #ccc",
      }}
    >
      <Icon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
      <Typography variant="h6" color="textSecondary">
        {message}
      </Typography>
    </Box>
  );
};

export default EmptyState;
