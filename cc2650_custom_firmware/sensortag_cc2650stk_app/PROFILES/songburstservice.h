/*
 * Our custom service for collecting a song data burst of 378 bytes.
 *
 * NOTE: This is adapted from the movementservice.h as a starting point.
 *       You may see various old references to it therefore.
 */

#ifndef MOVEMENTSERVICE_H
#define MOVEMENTSERVICE_H

#ifdef __cplusplus
extern "C"
{
#endif

/*********************************************************************
 * INCLUDES
 */
#include "st_util.h"

/*********************************************************************
 * CONSTANTS
 */

// Service UUID
#define MOVEMENT_SERV_UUID             0xAAA0
#define MOVEMENT_DATA_UUID             0xAAA1
#define MOVEMENT_CONF_UUID             0xAAA2

// Sensor Profile Services bit fields
#define MOVEMENT_SERVICE               0x000000A0

/*********************************************************************
 * TYPEDEFS
 */

/*********************************************************************
 * MACROS
 */


/*********************************************************************
 * API FUNCTIONS
 */


/*
 * Song_addService - Initializes the Sensor GATT Profile service by
 *          registering GATT attributes with the GATT server.
 */
extern bStatus_t Song_addService(void);

/*
 * Song_registerAppCBs - Registers the application callback function.
 *                    Only call this function once.
 *
 *    appCallbacks - pointer to application callbacks.
 */
extern bStatus_t Song_registerAppCBs(sensorCBs_t *appCallbacks);

/*
 * Song_setParameter - Set a Sensor GATT Profile parameter.
 *
 *    param - Profile parameter ID
 *    len   - length of data to write
 *    value - pointer to data to write.  This is dependent on
 *          the parameter ID and WILL be cast to the appropriate
 *          data type (example: data type of uint16_t will be cast to
 *          uint16_t pointer).
 */
extern bStatus_t Song_setParameter(uint8_t param, uint16_t len, void *value);

/*
 * Song_getParameter - Get a Sensor GATT Profile parameter.
 *
 *    param - Profile parameter ID
 *    value - pointer to data to read.  This is dependent on
 *          the parameter ID and WILL be cast to the appropriate
 *          data type (example: data type of uint16_t will be cast to
 *          uint16_t pointer).
 */
extern bStatus_t Song_getParameter(uint8_t param, void *value);


/*********************************************************************
*********************************************************************/

#ifdef __cplusplus
}
#endif

#endif /* MOVEMENTSERVICE_H */
