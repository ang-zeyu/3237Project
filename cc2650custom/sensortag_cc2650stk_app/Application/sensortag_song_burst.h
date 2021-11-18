/*
 * Our custom application interface for the song burst service
 *
 * The actual service is in songburstservice.c / h
 *
 * NOTE: This is adapted from the movementservice.h as a starting point.
 *       You may see various old references to it therefore.
 */

#ifndef SENSORTAGMOV_H
#define SENSORTAGMOV_H

#ifdef __cplusplus
extern "C"
{
#endif

/*********************************************************************
 * INCLUDES
 */
#include "sensortag.h"

/*********************************************************************
 * CONSTANTS
 */

/*********************************************************************
 * MACROS
 */

/*********************************************************************
 * FUNCTIONS
 */

#ifndef EXCLUDE_MOV
/*
 * Initialize Movement sensor module
 */
extern void SensorTagSong_init(void);

/*
 * Task Event Processor for Movement sensor module
 */
extern void SensorTagSong_processSensorEvent(void);

/*
 * Task Event Processor for characteristic changes
 */
extern void SensorTagSong_processCharChangeEvt(uint8_t paramID);

/*
 * Reset Movement sensor module
 */
extern void SensorTagSong_reset(void);

#else

/* Movement module not included */

#define SensorTagSong_init()
#define SensorTagSong_processCharChangeEvt(paramID)
#define SensorTagSong_processSensorEvent()
#define SensorTagSong_reset()

#endif // EXCLUDE_MOV

/*********************************************************************
*********************************************************************/

#ifdef __cplusplus
}
#endif

#endif /* SENSORTAGMOV_H */
