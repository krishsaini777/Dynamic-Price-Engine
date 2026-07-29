import React from "react";
import { Box, Typography, Breadcrumbs, Link as MuiLink } from "@mui/material";
import { Link } from "react-router-dom";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

const PageHeader = ({ title, breadcrumbs = [], rightContent }) => {
  return (
    <Box
      sx={{
        mb: 4,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <Box>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontWeight: 600, color: "#111827" }}
        >
          {title}
        </Typography>

        {breadcrumbs.length > 0 && (
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" />}
            aria-label="breadcrumb"
          >
            <MuiLink component={Link} to="/" color="inherit" underline="hover">
              Home
            </MuiLink>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return isLast ? (
                <Typography key={index} color="text.primary">
                  {crumb.label}
                </Typography>
              ) : (
                <MuiLink
                  key={index}
                  component={Link}
                  to={crumb.path}
                  color="inherit"
                  underline="hover"
                >
                  {crumb.label}
                </MuiLink>
              );
            })}
          </Breadcrumbs>
        )}
      </Box>

      {rightContent && <Box>{rightContent}</Box>}
    </Box>
  );
};

export default PageHeader;
